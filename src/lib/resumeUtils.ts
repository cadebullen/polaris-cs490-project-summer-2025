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
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Merge resume data into LaTeX template (simple string replace, customize as needed)
function mergeResumeWithTemplate(resume: any, template: any): string {
  console.log('Merging resume with template...');
  console.log('Template content preview:', template?.content?.substring(0, 200));
  console.log('Resume data keys:', Object.keys(resume || {}));
  
  let latex = template?.content || template || '';
  
  if (!latex) {
    throw new Error('Template content is empty or missing');
  }
  
  // Convert literal \n strings to actual newlines
  latex = latex.replace(/\\n/g, '\n');
  
  if (!resume) {
    throw new Error('Resume data is missing');
  }

  // Handle case where resume is a plain text string (unformatted resume)
  if (typeof resume === 'string') {
    console.log('Resume is unformatted text, creating simple LaTeX document...');
    
    // Create a simple LaTeX document with the unformatted text
    const sanitizedText = sanitizeForLatex(resume);
    
    // Replace the {{RESUME_CONTENT}} placeholder with formatted text
    if (latex.includes('{{RESUME_CONTENT}}')) {
      // Create formatted content from the unformatted text
      const latexLines = sanitizedText.split('\n').map(line => line.trim()).filter(line => line);
      const beginCenter = '\\begin{center}';
      const largeTitle = '{\\Large \\textbf{Resume}}';
      const endCenter = '\\end{center}';
      const vspace = '\\vspace{5mm}';
      const lineBreak = ' \\\\';
      
      const formattedContent = [
        '',
        beginCenter,
        largeTitle,
        endCenter,
        '',
        vspace,
        '',
        latexLines.join(lineBreak + '\n'),
        ''
      ].join('\n');
      
      latex = latex.replace('{{RESUME_CONTENT}}', formattedContent);
    } else {
      // Fallback: find the document body and replace it with our text
      if (latex.includes('\\begin{document}') && latex.includes('\\end{document}')) {
        const beforeDoc = latex.substring(0, latex.indexOf('\\begin{document}') + '\\begin{document}'.length);
        const afterDoc = latex.substring(latex.indexOf('\\end{document}'));
        
        // Create formatted content from the unformatted text
        const latexLines = sanitizedText.split('\n').map(line => line.trim()).filter(line => line);
        const beginCenter = '\\begin{center}';
        const largeTitle = '{\\Large \\textbf{Resume}}';
        const endCenter = '\\end{center}';
        const vspace = '\\vspace{5mm}';
        const lineBreak = ' \\\\';
        
        const formattedContent = [
          '',
          beginCenter,
          largeTitle,
          endCenter,
          '',
          vspace,
          '',
          latexLines.join(lineBreak + '\n'),
          ''
        ].join('\n');
        
        latex = beforeDoc + formattedContent + afterDoc;
      } else {
        // Fallback: create a complete simple document
        const latexLines = sanitizedText.split('\n').map(line => line.trim()).filter(line => line);
        const docClass = '\\documentclass[11pt]{article}';
        const geometry = '\\usepackage[margin=1in]{geometry}';
        const inputenc = '\\usepackage[utf8]{inputenc}';
        const beginDoc = '\\begin{document}';
        const beginCenter = '\\begin{center}';
        const largeTitle = '{\\Large \\textbf{Resume}}';
        const endCenter = '\\end{center}';
        const vspace = '\\vspace{5mm}';
        const lineBreak = ' \\\\';
        const endDoc = '\\end{document}';
        
        latex = [
          docClass,
          geometry,
          inputenc,
          '',
          beginDoc,
          '',
          beginCenter,
          largeTitle,
          endCenter,
          '',
          vspace,
          '',
          latexLines.join(lineBreak + '\n'),
          '',
          endDoc
        ].join('\n');
      }
    }
    
    console.log('Merged LaTeX content preview:', latex.substring(0, 500));
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
  
  try {
    // Create query parameter for the service
    const encodedLatex = encodeURIComponent(latexContent);
    const url = `${LATEX_ONLINE_URL}?text=${encodedLatex}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud LaTeX compilation failed: ${response.status} - ${errorText}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    console.log('Cloud compilation successful, PDF size:', pdfBuffer.length);
    return pdfBuffer;
    
  } catch (error) {
    console.error('Cloud LaTeX compilation error:', error);
    throw new Error(`Cloud compilation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Compile LaTeX to PDF using pdflatex
async function compileLatexToPdf(latexContent: string): Promise<Buffer> {
  // Validate LaTeX content
  if (!latexContent || typeof latexContent !== 'string') {
    throw new Error('Invalid LaTeX content provided');
  }
  
  // Basic LaTeX structure validation
  if (!latexContent.includes('\\documentclass') && !latexContent.includes('\\begin{document}')) {
    console.warn('LaTeX content may be missing document structure');
  }
  
  // Use OS-appropriate temp directory
  const tmpDir = path.join(os.tmpdir(), `resume_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  
  console.log('Creating temporary directory:', tmpDir);
  await fs.mkdir(tmpDir, { recursive: true });
  
  const texPath = path.join(tmpDir, 'resume.tex');
  const pdfPath = path.join(tmpDir, 'resume.pdf');
  
  console.log('Writing LaTeX content to:', texPath);
  console.log('LaTeX content length:', latexContent.length);
  
  // Write LaTeX content with UTF-8 encoding
  await fs.writeFile(texPath, latexContent, { encoding: 'utf8' });
  return new Promise((resolve, reject) => {
    console.log('Starting pdflatex compilation...');
    // Add additional flags for better error handling and UTF-8 support
    const pdflatexArgs = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-file-line-error',
      '-output-directory', tmpDir,
      texPath
    ];
    
    console.log('Running command: pdflatex', pdflatexArgs.join(' '));
    const proc = spawn('pdflatex', pdflatexArgs, {
      cwd: tmpDir, // Set working directory
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TEXMFOUTPUT: tmpDir } // Set LaTeX output directory
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('pdflatex stdout:', output);
    });
    
    proc.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error('pdflatex stderr:', output);
    });
    
    proc.on('error', (error) => {
      console.error('pdflatex spawn error:', error);
      reject(new Error(`pdflatex spawn failed: ${error.message}`));
    });
    
    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          const pdfBuffer = await fs.readFile(pdfPath);
          // Clean up
          await fs.rm(tmpDir, { recursive: true, force: true });
          resolve(pdfBuffer);
        } catch (err) {
          console.error('Failed to read generated PDF:', err);
          reject(err);
        }
      } else {
        console.error('pdflatex failed with exit code:', code);
        console.error('pdflatex stdout:', stdout);
        console.error('pdflatex stderr:', stderr);
        
        // Try to read the log file for more details
        try {
          const logPath = path.join(tmpDir, 'resume.log');
          const logContent = await fs.readFile(logPath, 'utf8');
          console.error('pdflatex log file:', logContent);
        } catch (logErr) {
          console.error('Could not read pdflatex log file:', logErr);
        }
        
        // Clean up even on failure
        try {
          await fs.rm(tmpDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error('Failed to cleanup tmp directory:', cleanupErr);
        }
        
        reject(new Error(`pdflatex failed with exit code ${code}. Check server logs for details.`));
      }
    });
  });
}

// Main function: merge, compile, return PDF buffer
export async function generatePdfBuffer(resume: any, template: any): Promise<Buffer> {
  const latexContent = mergeResumeWithTemplate(resume, template);
  
  // Try cloud compilation first (works for all users)
  if (USE_CLOUD_LATEX) {
    try {
      console.log('Attempting cloud-based LaTeX compilation...');
      return await compileLatexInCloud(latexContent);
    } catch (cloudError) {
      console.warn('Cloud compilation failed, trying local fallback:', cloudError instanceof Error ? cloudError.message : String(cloudError));
      
      // Only try local if we're in development or if local LaTeX is explicitly available
      if (process.env.NODE_ENV === 'development' || process.env.LOCAL_LATEX_AVAILABLE === 'true') {
        try {
          console.log('Attempting local LaTeX compilation as fallback...');
          return await compileLatexToPdf(latexContent);
        } catch (localError) {
          console.error('Both cloud and local compilation failed');
          throw new Error(`PDF generation failed. Cloud: ${cloudError instanceof Error ? cloudError.message : String(cloudError)}, Local: ${localError instanceof Error ? localError.message : String(localError)}`);
        }
      } else {
        // In production or when local LaTeX is not available, just throw the cloud error
        throw cloudError;
      }
    }
  } else {
    // If cloud is disabled, try local first
    try {
      console.log('Cloud compilation disabled, using local LaTeX...');
      return await compileLatexToPdf(latexContent);
    } catch (localError) {
      console.warn('Local compilation failed, trying cloud as fallback:', localError instanceof Error ? localError.message : String(localError));
      try {
        return await compileLatexInCloud(latexContent);
      } catch (cloudError) {
        throw new Error(`PDF generation failed. Local: ${localError instanceof Error ? localError.message : String(localError)}, Cloud: ${cloudError instanceof Error ? cloudError.message : String(cloudError)}`);
      }
    }
  }
}
