import { NextRequest, NextResponse } from 'next/server';
import { getResumeData, getTemplateContent, generatePdfBuffer } from '../../../lib/resumeUtils';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Helper: Convert PDF buffer to PNG using pdftoppm (Poppler)
async function pdfBufferToPng(pdfBuffer: Buffer): Promise<Buffer> {
  const tmpPdf = path.join('/tmp', `resume_${Date.now()}.pdf`);
  const tmpPng = path.join('/tmp', `resume_${Date.now()}.png`);
  await fs.writeFile(tmpPdf, pdfBuffer);
  return new Promise((resolve, reject) => {
    const proc = spawn('pdftoppm', ['-png', '-singlefile', tmpPdf, tmpPng.replace(/\.png$/, '')]);
    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          const pngBuffer = await fs.readFile(tmpPng);
          await fs.unlink(tmpPdf);
          await fs.unlink(tmpPng);
          resolve(pngBuffer);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('pdftoppm failed'));
      }
    });
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resumeId = searchParams.get('resumeId');
  const templateId = searchParams.get('templateId');
  console.log('[resumePreview] resumeId:', resumeId, 'templateId:', templateId);
  if (!resumeId || !templateId) {
    return NextResponse.json({ error: 'Missing resumeId or templateId' }, { status: 400 });
  }
  // Fetch resume and template data (implement these functions for your DB)
  const resume = await getResumeData(resumeId);
  const template = await getTemplateContent(templateId);
  console.log('[resumePreview] resume:', resume);
  console.log('[resumePreview] template:', template);
  if (!resume || !template) {
    return NextResponse.json({ error: 'Resume or template not found', resume, template }, { status: 404 });
  }
  // Generate PDF buffer (implement this for your LaTeX logic)
  const pdfBuffer = await generatePdfBuffer(resume, template);
  // Convert PDF to PNG
  try {
    const pngBuffer = await pdfBufferToPng(pdfBuffer);
    // Convert Node.js Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate preview', details: String(err) }, { status: 500 });
  }
}
