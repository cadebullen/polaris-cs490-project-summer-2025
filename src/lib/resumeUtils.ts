import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from './firebaseAdmin';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Configuration for cloud LaTeX
const LATEX_ONLINE_URL = 'https://latexonline.cc/compile';
const USE_CLOUD_LATEX = process.env.NODE_ENV === 'production' || process.env.USE_CLOUD_LATEX === 'true';

// Fetch resume data from Firestore by resumeId
export async function getResumeData(resumeId: string) {
  const db = getFirestore(getFirebaseAdminApp());
  const doc = await db.collection('resumes').doc(resumeId).get();
  return doc.exists ? doc.data() : null;
}

// Fetch template content from Firestore by templateId
export async function getTemplateContent(templateId: string) {
  const db = getFirestore(getFirebaseAdminApp());
  const doc = await db.collection('templates').doc(templateId).get();
  const data = doc.exists ? doc.data() : null;
  
  if (data && data.content) {
    console.log('Raw template content from DB:', data.content.substring(0, 100));
    
    // Fix double-escaped content if present
    let fixedContent = data.content;
    if (typeof fixedContent === 'string' && fixedContent.includes('\\\\\\\\')) {
      console.log('Fixing double-escaped content...');
      // Keep fixing until no more quadruple backslashes
      while (fixedContent.includes('\\\\\\\\')) {
        fixedContent = fixedContent.replace(/\\\\\\\\/g, '\\\\');
      }
      // Fix escaped newlines
      fixedContent = fixedContent.replace(/\\\\n/g, '\n');
      
      console.log('Fixed content preview:', fixedContent.substring(0, 100));
      data.content = fixedContent;
    }
  // End of plain text resume logic
  }
  return data;
}

// Sanitize text for LaTeX by escaping special characters
function sanitizeForLatex(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    // Escape LaTeX special characters
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\textasciitilde{}')
    // Remove or replace problematic characters
    .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove non-ASCII characters
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    // Clean up extra spaces/tabs but preserve newlines
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Merge resume data into LaTeX template (simple string replace, customize as needed)
export function mergeResumeWithTemplate(resume: any, template: any): string {
  console.log('Merging resume with template...');
  console.log('Template type:', typeof template);
  console.log('Template keys:', Object.keys(template || {}));
  
  let latex = template?.content || template || '';
  if (!latex) {
    throw new Error('Template content is empty or missing');
  }

  console.log('Template content preview:', latex.substring(0, 200));

  // Remove any extra \begin{document} and \end{document} after the first \begin{document}
  const firstDocIdx = latex.indexOf('\\begin{document}');
  if (firstDocIdx !== -1) {
    // Find the end of the first \begin{document}
    const beforeDoc = latex.slice(0, firstDocIdx + 16); // length of "\\begin{document}"
    let afterDoc = latex.slice(firstDocIdx + 16);
    // Remove all subsequent \begin{document} and \end{document} in afterDoc
    afterDoc = afterDoc.replace(/\\begin\{document\}/g, '');
    afterDoc = afterDoc.replace(/\\end\{document\}/g, '');
    latex = beforeDoc + afterDoc;
  }

  // Validate template has required placeholder
  if (!latex.includes('{{RESUME_CONTENT}}')) {
    console.warn('Template missing {{RESUME_CONTENT}} placeholder');
    throw new Error('Template is missing required {{RESUME_CONTENT}} placeholder');
  }
  
  // Check for common LaTeX syntax errors and auto-fix them
  const syntaxErrors = [];
  
  // Fix missing backslashes in ALL LaTeX commands - comprehensive
  latex = latex.replace(/([^\\]|^)ewcommand/g, '$1\\newcommand');
  latex = latex.replace(/([^\\]|^)ewlength/g, '$1\\newlength');
  latex = latex.replace(/([^\\]|^)ormalsize/g, '$1\\normalsize');
  latex = latex.replace(/([^\\]|^)oindent/g, '$1\\noindent');
  latex = latex.replace(/([^\\]|^)itleformat/g, '$1\\titleformat');
  latex = latex.replace(/([^\\]|^)itlespacing/g, '$1\\titlespacing');
  
  // More aggressive Creative template fixes based on console errors
  latex = latex.replace(/([^\\]|^)ewcommand\*/g, '$1\\newcommand*');
  latex = latex.replace(/\\newcommand\*\\Hs\\{/g, '\\newcommand*{\\Hs}{');
  latex = latex.replace(/\\Hs\\{\\ensuremath/g, '\\newcommand*{\\Hs}{\\ensuremath');
  
  // Fix broken command definitions from console logs
  latex = latex.replace(/ewcommand\\{\\heartstab\\}\\{/g, '\\newcommand{\\heartstab}{');
  latex = latex.replace(/ewcommand\\{\\squigarr\\}\\{/g, '\\newcommand{\\squigarr}{');
  latex = latex.replace(/ewlength\\{\\spacebox\\}/g, '\\newlength{\\spacebox}');
  latex = latex.replace(/ewcommand\\{\\sepspace\\}\\{/g, '\\newcommand{\\sepspace}{');
  latex = latex.replace(/ewcommand\\{\\MyName\\}\\[1\\]\\{/g, '\\newcommand{\\MyName}[1]{');
  latex = latex.replace(/ewcommand\\{\\MySlogan\\}\\[1\\]\\{/g, '\\newcommand{\\MySlogan}[1]{');
  latex = latex.replace(/ewcommand\\{\\NameEmailPhoneSiteGithub\\}\\[5\\]\\{/g, '\\newcommand{\\NameEmailPhoneSiteGithub}[5]{');
  latex = latex.replace(/ewcommand\\{\\NewPart\\}\\[1\\]\\{/g, '\\newcommand{\\NewPart}[1]{');
  latex = latex.replace(/ewcommand\\{\\SkillsEntry\\}\\[2\\]\\{/g, '\\newcommand{\\SkillsEntry}[2]{');
  
  // Fix parameter number issues in macro definitions
  latex = latex.replace(/\\newcommand\{([^}]+)\}\{([^#]*#1[^}]*)\}/g, '\\newcommand{$1}[1]{$2}');
  latex = latex.replace(/\\newcommand\{([^}]+)\}\{([^#]*#1[^#]*#2[^}]*)\}/g, '\\newcommand{$1}[2]{$2}');
  latex = latex.replace(/\\newcommand\{([^}]+)\}\{([^#]*#1[^#]*#2[^#]*#3[^#]*#4[^#]*#5[^}]*)\}/g, '\\newcommand{$1}[5]{$2}');
  
  // Fix broken titleformat commands with line breaks and missing braces
  latex = latex.replace(/\\titleformat\{\\section\}\{\s*\\large\s*\\bfseries\s*\\scshape\s*\}\s*\{/g, '\\titleformat{\\section}{\\large\\bfseries\\scshape}{');
  latex = latex.replace(/\\titleformat\{\\subsection\}\s*\{\s*\n?\s*ormalsize/g, '\\titleformat{\\subsection}{\\small\\bfseries');
  latex = latex.replace(/\\titleformat\{\\subsection\}\s*\{\s*\\normalsize\s*\\bfseries\s*\}\s*\{/g, '\\titleformat{\\subsection}{\\small\\bfseries}{');
  latex = latex.replace(/\\titleformat\{\\subsection\}\s*\{\s*\\small\s*\\bfseries\s*\}\s*\{/g, '\\titleformat{\\subsection}{\\small\\bfseries}{');
  
  // Fix incomplete titleformat commands
  latex = latex.replace(/\\titleformat\{\\subsection\}\{([^}]+)\}$/gm, '\\titleformat{\\subsection}{$1}{}{0pt}{}');
  latex = latex.replace(/\\titleformat\{\\section\}\{([^}]+)\}$/gm, '\\titleformat{\\section}{$1}{}{0pt}{}');
  
  // Fix spacing issues in titlespacing
  latex = latex.replace(/\\titlespacing\*\{\\section\}\{0pt\}\{18pt\}\{10pt\}/g, '\\titlespacing*{\\section}{0pt}{18pt}{10pt}');
  latex = latex.replace(/\\titlespacing\*\{\\subsection\}\{0pt\}\{8pt\}\{4pt\}/g, '\\titlespacing*{\\subsection}{0pt}{8pt}{4pt}');
  
  // Remove any stray \t characters and fix common character issues
  latex = latex.replace(/\\t([^a-zA-Z])/g, '$1');
  latex = latex.replace(/\r\n/g, '\n');
  latex = latex.replace(/\r/g, '\n');
  
  // Fix common package issues
  latex = latex.replace(/\\usepackage\{utf8\}\{inputenc\}/g, '\\usepackage[utf8]{inputenc}');
  latex = latex.replace(/\\usepackage\{margin=([^}]+)\}\{geometry\}/g, '\\usepackage[margin=$1]{geometry}');
  
  // Fix missing closing braces for titleformat
  if (latex.includes('\\titleformat{\\section}') && !latex.match(/\\titleformat\{\\section\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}/)) {
    latex = latex.replace(/\\titleformat\{\\section\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}([^}]*)/g, 
                         '\\titleformat{\\section}{$1}{$2}{$3}{$4}');
  }
  
  console.log('Applied comprehensive template fixes');
  console.log('Fixed template preview:', latex.substring(0, 400));
  
  // Validate the template structure
  const validationErrors = [];
  if (!latex.includes('\\documentclass')) {
    validationErrors.push('Missing \\documentclass');
  }
  if (!latex.includes('\\begin{document}')) {
    validationErrors.push('Missing \\begin{document}');
  }
  if (!latex.includes('\\end{document}')) {
    validationErrors.push('Missing \\end{document}');
  }
  
  // Check for unmatched braces in titleformat commands
  const titleformatMatches = latex.match(/\\titleformat\{[^}]*\}/g);
  if (titleformatMatches) {
    titleformatMatches.forEach((match: string) => {
      const openBraces = (match.match(/\{/g) || []).length;
      const closeBraces = (match.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        validationErrors.push(`Unmatched braces in: ${match}`);
      }
    });
  }
  
  if (validationErrors.length > 0) {
    console.warn('Template validation warnings:', validationErrors);
  } else {
    console.log('✅ Template validation passed');
  }
  
  console.log('Template validation passed');
  
  // Convert literal \n strings to actual newlines
  latex = latex.replace(/\\n/g, '\n');
  if (!resume) {
    throw new Error('Resume data is missing');
  }
  // Handle case where resume is a plain text string (unformatted resume)
  if (typeof resume === 'string') {
    console.log('Resume is unformatted text, creating enhanced LaTeX document...');
    const sanitizedText = sanitizeForLatex(resume);
    
    // Parse the resume content and format it properly
    const lines = sanitizedText.split('\n').map(line => line.trimEnd());
    let formattedContent = '';
    let inItemize = false;
    let currentSection = '';
    
    // Extract name and contact info from first few lines
    let name = '';
    let contactInfo = '';
    let contentStartIndex = 0;
    
    // Find name (usually first non-empty line)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && !line.includes('@') && !line.includes('(') && !line.match(/^\d+/)) {
        name = line;
        contentStartIndex = i + 1;
        break;
      }
    }
    
    // Find contact info (email, phone)
    for (let i = contentStartIndex; i < Math.min(8, lines.length); i++) {
      const line = lines[i].trim();
      if (line && (line.includes('@') || line.includes('(') || line.match(/^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/))) {
        contactInfo += (contactInfo ? ' | ' : '') + line;
        contentStartIndex = i + 1;
      } else if (line && contactInfo) {
        break; // Stop after contact info section
      }
    }
    
    // Add header with name and contact
    if (name) {
      formattedContent += `\\begin{center}\n{\\LARGE \\textbf{${name}}}`;
      if (contactInfo) {
        formattedContent += `\\\\[4pt]\n{\\large ${contactInfo}}`;
      }
      formattedContent += '\n\\end{center}\n\\vspace{8pt}\n';
    }
    
    // Process remaining content
    const contentLines = lines.slice(contentStartIndex);
    
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i].trim();
      if (!line) continue;
      
      // Section headers (all caps, common section names)
      const isSection = line === line.toUpperCase() && line.length > 2 &&
        /^[A-Z\s&-]+$/.test(line) &&
        (line.includes('SUMMARY') || line.includes('SKILLS') || line.includes('EDUCATION') ||
         line.includes('EXPERIENCE') || line.includes('OBJECTIVE') || line.includes('CONTACT') ||
         line.includes('PROGRAMMING') || line.includes('LANGUAGES') || line.includes('TECHNOLOGIES') ||
         line.includes('COMPETENCIES') || line.includes('CERTIFICATIONS') || line.includes('PROJECTS'));
      
      if (isSection) {
        if (inItemize) { 
          formattedContent += '\\end{itemize}\n'; 
          inItemize = false; 
        }
        formattedContent += `\\section*{${line}}\n`;
        currentSection = line;
        continue;
      }
      
      // Skills section - treat as bullet points
      if (currentSection.includes('SKILLS') || currentSection.includes('TECHNOLOGIES')) {
        // Check if this is a skills subsection
        if (/^[A-Z\s&-]+:/.test(line) && line.length < 60) {
          if (inItemize) { 
            formattedContent += '\\end{itemize}\n'; 
            inItemize = false; 
          }
          formattedContent += `\\vspace{4pt}\\noindent\\textbf{${line}}\\\\[2pt]\n`;
          continue;
        }
        // Regular skill items
        if (!inItemize) { 
          formattedContent += '\\begin{itemize}\n'; 
          inItemize = true; 
        }
        formattedContent += `\\item ${line}\n`;
        continue;
      }
      
      // Experience/Projects section
      if (currentSection.includes('EXPERIENCE') || currentSection.includes('PROJECTS')) {
        // Company/Organization names (all caps or title case with organization indicators)
        if (/^[A-Z][A-Z\s&-]*[A-Z]$/.test(line) && line.length < 60) {
          if (inItemize) { 
            formattedContent += '\\end{itemize}\n'; 
            inItemize = false; 
          }
          formattedContent += `\\vspace{6pt}\\noindent\\textbf{\\large ${line}}\\\\[2pt]\n`;
          continue;
        }
        
        // Job titles and dates
        if (line.includes(',') && (/\d{4}/.test(line) || line.includes('Current') || line.includes('Present'))) {
          formattedContent += `\\textit{${line}}\\\\[2pt]\n`;
          continue;
        }
        
        // Bullet points for responsibilities
        if (!inItemize) { 
          formattedContent += '\\begin{itemize}\n'; 
          inItemize = true; 
        }
        formattedContent += `\\item ${line}\n`;
        continue;
      }
      
      // Education section
      if (currentSection.includes('EDUCATION')) {
        // School names
        if (/^[A-Z][A-Z\s&-]*[A-Z]$/.test(line) && line.length < 60) {
          if (inItemize) { 
            formattedContent += '\\end{itemize}\n'; 
            inItemize = false; 
          }
          formattedContent += `\\vspace{6pt}\\noindent\\textbf{\\large ${line}}\\\\[2pt]\n`;
          continue;
        }
        
        // Degree and dates
        formattedContent += `${line}\\\\[2pt]\n`;
        continue;
      }
      
      // Default: regular paragraph text
      if (inItemize) { 
        formattedContent += '\\end{itemize}\n'; 
        inItemize = false; 
      }
      formattedContent += `${line}\\\\[4pt]\n`;
    }
    
    // Close any open itemize
    if (inItemize) {
      formattedContent += '\\end{itemize}\n';
    }
    
    // Replace the content placeholder
    latex = latex.replace('{{RESUME_CONTENT}}', formattedContent);
    
    console.log('Merged LaTeX content preview:', latex.substring(0, 500));
    console.log('Full LaTeX content length:', latex.length);
    return latex;
  }
  
  // Handle structured resume object (existing logic)
  Object.keys(resume).forEach(key => {
    const value = resume[key];
    if (typeof value === 'string') {
      const sanitizedValue = sanitizeForLatex(value);
      latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), sanitizedValue);
    } else if (Array.isArray(value)) {
      // Handle arrays (like skills, emails, phones)
      if (key === 'skills') {
        const skillsText = value.map(skill => sanitizeForLatex(String(skill))).join(', ');
        latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), skillsText);
      } else if (key === 'emails') {
        const emailsText = value.map(email => sanitizeForLatex(String(email))).join(', ');
        latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), emailsText);
      } else if (key === 'phones') {
        const phonesText = value.map(phone => sanitizeForLatex(String(phone))).join(', ');
        latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), phonesText);
      } else if (key === 'education') {
        // Handle education array
        const educationText = value.map((edu: any) => {
          const degree = sanitizeForLatex(edu.degree || '');
          const school = sanitizeForLatex(edu.school || '');
          const years = sanitizeForLatex(edu.years || '');
          return `${degree} - ${school} (${years})`;
        }).join('\\\\ ');
        latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), educationText);
      } else if (key === 'jobHistory') {
        // Handle job history array
        const jobText = value.map((job: any) => {
          const title = sanitizeForLatex(job.title || '');
          const company = sanitizeForLatex(job.company || '');
          const dates = sanitizeForLatex(job.dates || '');
          return `${title} at ${company} (${dates})`;
        }).join('\\\\ ');
        latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), jobText);
      } else {
        // Generic array handling
        const arrayText = value.map(item => sanitizeForLatex(String(item))).join(', ');
        latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), arrayText);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle objects by converting to string and sanitizing
      const objText = sanitizeForLatex(JSON.stringify(value));
      latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), objText);
    } else {
      // Handle other types
      const sanitizedValue = sanitizeForLatex(String(value || ''));
      latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), sanitizedValue);
    }
  });
  
  // Replace any remaining placeholders with empty strings to avoid LaTeX errors
  latex = latex.replace(/\{\{[^}]+\}\}/g, '');
  
  console.log('Merged LaTeX content preview:', latex.substring(0, 500));
  return latex;
}

// Compile LaTeX in the cloud using LaTeX Online service
async function compileLatexInCloud(latexContent: string): Promise<Buffer> {
  console.log('Compiling LaTeX in cloud...');
  console.log('LaTeX content length:', latexContent.length);
  console.log('LaTeX preview (first 200 chars):', latexContent.substring(0, 200));

  // latexonline.cc GET API: https://latexonline.cc/compile?text=...&format=pdf
  // Limit: URL length must be < 2000 chars (safe for most browsers/servers)
  const baseUrl = 'https://latexonline.cc/compile?format=pdf&text=';
  const encoded = encodeURIComponent(latexContent);
  const fullUrl = baseUrl + encoded;
  if (fullUrl.length > 2000) {
    throw new Error('LaTeX document is too large for cloud compilation via GET. Please use a shorter template or reduce resume content.');
  }
  console.log('Requesting:', fullUrl.substring(0, 200) + (fullUrl.length > 200 ? '... (truncated)' : ''));
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/pdf',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('LaTeX compilation failed with status:', response.status);
    console.error('Error response body:', errorText);
    throw new Error(`Cloud LaTeX compilation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('pdf')) {
    const responseText = await response.text();
    console.error('Non-PDF response body:', responseText.substring(0, 500));
    throw new Error(`Expected PDF but got ${contentType}: ${responseText.substring(0, 200)}`);
  }
  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  console.log('Cloud compilation successful, PDF size:', pdfBuffer.length);
  return pdfBuffer;
}

// Exported function to generate PDF buffer from resume and template
export async function generatePdfBuffer(resume: any, template: any): Promise<{buffer: Buffer, isLatex: boolean}> {
  const latexContent = mergeResumeWithTemplate(resume, template);
  console.log('USE_CLOUD_LATEX:', USE_CLOUD_LATEX);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('USE_CLOUD_LATEX env var:', process.env.USE_CLOUD_LATEX);
  
  if (USE_CLOUD_LATEX) {
    console.log('🔄 Attempting LaTeX compilation with ORIGINAL template...');
    const pdfBuffer = await compileLatexInCloud(latexContent);
    console.log('✅ SUCCESS: ORIGINAL TEMPLATE WORKS! Unique design preserved. PDF size:', pdfBuffer.length);
    return { buffer: pdfBuffer, isLatex: false };
  } else {
    console.log('Using local mode, returning LaTeX content');
    return { buffer: Buffer.from(latexContent), isLatex: true };
  }
}


