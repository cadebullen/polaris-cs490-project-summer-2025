import { NextRequest, NextResponse } from 'next/server';
import { getTemplateContent, generatePdfBuffer } from '../../../lib/resumeUtils';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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

    // Generate PDF buffer using the actual resume content
    const pdfBuffer = await generatePdfBuffer(resumeContent, template);
    
    // On Windows, pdftoppm isn't available, so return PDF directly
    // Browsers can't display PDFs in <img> tags, so this will fallback to static images
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { 
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
    });
  } catch (err) {
    console.error('Preview generation error:', err);
    return NextResponse.json({ error: 'Failed to generate preview', details: String(err) }, { status: 500 });
  }
}
