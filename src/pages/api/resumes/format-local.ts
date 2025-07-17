// File: src/pages/api/resumes/format-local.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb', // adjust as needed
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  let { latexContent, templateContent, resumeContent, templateId } = req.body;

  // If template and resume content are provided separately, merge them
  if (templateContent && resumeContent) {
    const { mergeResumeWithTemplate } = await import('../../../lib/resumeUtils');
    latexContent = mergeResumeWithTemplate(resumeContent, templateContent);
    console.log('Server-side merged LaTeX length:', latexContent.length);
  }

  if (!latexContent || typeof latexContent !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid LaTeX content.' });
  }

  // Create a unique temp directory
  const tmpDir = path.join(os.tmpdir(), 'resume-' + crypto.randomBytes(8).toString('hex'));
  await fs.mkdir(tmpDir, { recursive: true });

  const texPath = path.join(tmpDir, 'resume.tex');
  const pdfPath = path.join(tmpDir, 'resume.pdf');

  try {
    // Write LaTeX to file
    await fs.writeFile(texPath, latexContent, 'utf8');

    // Run pdflatex
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('pdflatex', ['-interaction=nonstopmode', '-output-directory', tmpDir, texPath], { cwd: tmpDir });
      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('pdflatex failed: ' + stderr));
      });
    });

    // Read PDF and send as response
    const pdfBuffer = await fs.readFile(pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate PDF.' });
  } finally {
    // Clean up temp files (optional, best effort)
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
