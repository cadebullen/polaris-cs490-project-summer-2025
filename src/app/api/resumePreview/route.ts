import { NextRequest, NextResponse } from 'next/server';
import { getTemplateContent } from '../../../lib/resumeUtils';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Helper: Convert PDF buffer to PNG using pdftoppm (Poppler) or fallback
async function pdfBufferToPng(pdfBuffer: Buffer): Promise<Buffer> {
  const tmpPdf = path.join(os.tmpdir(), `resume_${Date.now()}.pdf`);
  const tmpPng = path.join(os.tmpdir(), `resume_${Date.now()}.png`);
  
  await fs.writeFile(tmpPdf, pdfBuffer);
  return new Promise((resolve, reject) => {
    // Try pdftoppm first (available on Linux/Mac with Poppler)
    const proc = spawn('pdftoppm', ['-png', '-singlefile', tmpPdf, tmpPng.replace(/\.png$/, '')]);
    
    proc.on('error', (error) => {
      console.error('pdftoppm not available:', error.message);
      // Fallback: return the PDF buffer itself (browsers can display PDFs)
      resolve(pdfBuffer);
    });
    
    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          const pngBuffer = await fs.readFile(tmpPng);
          await fs.unlink(tmpPdf).catch(() => {});
          await fs.unlink(tmpPng).catch(() => {});
          resolve(pngBuffer);
        } catch (err) {
          console.error('Failed to read PNG file:', err);
          // Cleanup and fallback to PDF
          await fs.unlink(tmpPdf).catch(() => {});
          await fs.unlink(tmpPng).catch(() => {});
          resolve(pdfBuffer);
        }
      } else {
        console.error('pdftoppm failed with code:', code);
        // Cleanup and fallback to PDF
        await fs.unlink(tmpPdf).catch(() => {});
        await fs.unlink(tmpPng).catch(() => {});
        resolve(pdfBuffer);
      }
    });
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get('templateId');
  const resumeContent = searchParams.get('resumeContent');
  
  console.log('[resumePreview] templateId:', templateId);
  console.log('[resumePreview] resumeContent length:', resumeContent?.length || 0);
  
  if (!templateId || !resumeContent) {
    return NextResponse.json({ error: 'Missing templateId or resumeContent' }, { status: 400 });
  }

  try {
    // Fetch template data
    const template = await getTemplateContent(templateId);
    console.log('[resumePreview] template:', template);
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    console.log('[resumePreview] Using resume content, length:', resumeContent.length);

    // Generate PDF using local compilation with proper server-side merging
    const { mergeResumeWithTemplate } = await import('@/lib/resumeUtils');
    const mergedLatex = mergeResumeWithTemplate(resumeContent, template.content);
    
    // Create a unique temp directory
    const tmpDir = path.join(os.tmpdir(), 'preview-' + crypto.randomBytes(8).toString('hex'));
    await fs.mkdir(tmpDir, { recursive: true });

    const texPath = path.join(tmpDir, 'preview.tex');
    const pdfPath = path.join(tmpDir, 'preview.pdf');

    try {
      // Write LaTeX to file
      await fs.writeFile(texPath, mergedLatex, 'utf8');

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

      // Read PDF and return
      const pdfBuffer = await fs.readFile(pdfPath);
      
      // Check for download param
      const isDownload = searchParams.get('download') === '1';
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: { 
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="resume.pdf"`,
          'Cache-Control': 'public, max-age=300'
        },
      });
    } finally {
      // Clean up temp files
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.error('Preview generation error:', err);
    return NextResponse.json({ error: 'Failed to generate preview', details: String(err) }, { status: 500 });
  }
}
