import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from './firebaseAdmin';

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
  return doc.exists ? doc.data() : null;
}


import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Merge resume data into LaTeX template (simple string replace, customize as needed)
function mergeResumeWithTemplate(resume: any, template: any): string {
  let latex = template.content || '';
  // Example: Replace placeholders like {{name}}, {{email}}, etc.
  if (resume) {
    Object.keys(resume).forEach(key => {
      latex = latex.replace(new RegExp(`{{${key}}}`, 'g'), resume[key]);
    });
  }
  return latex;
}

// Compile LaTeX to PDF using pdflatex
async function compileLatexToPdf(latexContent: string): Promise<Buffer> {
  const tmpDir = path.join('/tmp', `resume_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(tmpDir, { recursive: true });
  const texPath = path.join(tmpDir, 'resume.tex');
  const pdfPath = path.join(tmpDir, 'resume.pdf');
  await fs.writeFile(texPath, latexContent);
  return new Promise((resolve, reject) => {
    const proc = spawn('pdflatex', ['-interaction=nonstopmode', '-output-directory', tmpDir, texPath]);
    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          const pdfBuffer = await fs.readFile(pdfPath);
          // Clean up
          await fs.rm(tmpDir, { recursive: true, force: true });
          resolve(pdfBuffer);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('pdflatex failed'));
      }
    });
  });
}

// Main function: merge, compile, return PDF buffer
export async function generatePdfBuffer(resume: any, template: any): Promise<Buffer> {
  const latexContent = mergeResumeWithTemplate(resume, template);
  return await compileLatexToPdf(latexContent);
}
