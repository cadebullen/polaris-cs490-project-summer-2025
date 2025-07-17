import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { generatePdfBuffer } from '../../../../lib/resumeUtils';

async function getResumeById(userId: string, resumeId: string) {
  // Replace with your real data fetching logic
  return {
    emails: ["user@example.com"],
    phones: ["555-1234"],
    objective: "Seeking a Software Engineering role...",
    skills: ["JavaScript", "React", "Node.js"],
    education: [
      {
        school: "NJIT",
        degree: "B.S. Computer Science",
        years: "2021-2025",
      },
    ],
    jobHistory: [
      {
        company: "Best Buy",
        title: "Geek Squad Lead",
        dates: "2023-Present",
        responsibilities: [
          "Managed team",
          "Improved sales",
        ],
      },
    ],
    bio: "Experienced developer...",
  };
}

export async function POST(request: Request) {
  try {
    const { userId, resumeId, format, resume: resumeData, latexTemplate } = await request.json();

    if (!resumeId || !format) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Handle LaTeX PDF generation
    if (format === "latex-pdf") {
      if (!resumeData) {
        return NextResponse.json({ error: "Missing resume data" }, { status: 400 });
      }

      let templateToUse = latexTemplate;

      // If no template is provided or undefined, use a simple default template
      if (!templateToUse || templateToUse.trim() === '' || templateToUse === undefined) {
        console.log('[LaTeX PDF] No template provided, using simple default template...');
        
        // Enhanced default template with better formatting for unformatted text
        templateToUse = `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{parskip}
\\pagestyle{empty}

\\begin{document}

\\begin{center}
{\\Large \\textbf{Professional Resume}}
\\end{center}

\\vspace{5mm}

{{RESUME_CONTENT}}

\\end{document}`;
        
        console.log('[LaTeX PDF] Using enhanced default template for custom formatting');
      }

      try {
        console.log('[LaTeX PDF] Starting compilation...');
        console.log('[LaTeX PDF] Raw latexTemplate from request:', typeof latexTemplate, latexTemplate ? latexTemplate.substring(0, 100) : 'NO TEMPLATE');
        console.log('[LaTeX PDF] Resume data type:', typeof resumeData);
        console.log('[LaTeX PDF] Resume data preview:', JSON.stringify(resumeData).substring(0, 200));
        console.log('[LaTeX PDF] Template content provided:', !!templateToUse);
        console.log('[LaTeX PDF] Template content length:', templateToUse?.length || 0);
        console.log('[LaTeX PDF] Template preview:', templateToUse?.substring(0, 100) || 'No template');
        
        const result = await generatePdfBuffer(resumeData, templateToUse);
        console.log('[LaTeX PDF] Compilation result - buffer size:', result.buffer.length, 'isLatex:', result.isLatex);

        if (result.isLatex) {
          // Return LaTeX content as plain text for debugging
          console.log('[LaTeX PDF] Returning LaTeX content as text (compilation failed)');
          return new Response(new Uint8Array(result.buffer), {
            status: 200,
            headers: {
              "Content-Type": "text/plain",
              "Content-Disposition": `attachment; filename=resume_${resumeId}.tex`,
            },
          });
        } else {
          // Return actual PDF
          console.log('[LaTeX PDF] Returning compiled PDF');
          return new Response(new Uint8Array(result.buffer), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename=resume_${resumeId}.pdf`,
            },
          });
        }
      } catch (error) {
        console.error('[LaTeX PDF] Compilation failed:', error);
        return NextResponse.json({ 
          error: "LaTeX compilation failed", 
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }
    }

    // Handle regular PDF generation (existing logic)
    if (format !== "pdf") {
      return NextResponse.json({ error: "Only PDF and LaTeX-PDF formats are supported" }, { status: 400 });
    }

    const resumeFromDb = await getResumeById(userId, resumeId);
    if (!resumeFromDb) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const { width, height } = page.getSize();
    const fontSize = 12;
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    let y = height - 50;

    function drawText(text: string) {
      page.drawText(text, {
        x: 50,
        y,
        size: fontSize,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
      });
      y -= fontSize + 8;
    }

    drawText("Resume");
    y -= 10;

    if (resumeFromDb.emails && resumeFromDb.emails.length > 0) {
      drawText("Emails: " + resumeFromDb.emails.join(", "));
    }
    if (resumeFromDb.phones && resumeFromDb.phones.length > 0) {
      drawText("Phones: " + resumeFromDb.phones.join(", "));
    }
    y -= 10;

    if (resumeFromDb.objective) {
      drawText("Objective:");
      drawText(resumeFromDb.objective);
      y -= 10;
    }

    if (resumeFromDb.skills && resumeFromDb.skills.length > 0) {
      drawText("Skills:");
      drawText(resumeFromDb.skills.join(", "));
      y -= 10;
    }

    if (resumeFromDb.education && resumeFromDb.education.length > 0) {
      drawText("Education:");
      for (const edu of resumeFromDb.education) {
        drawText(`${edu.degree} - ${edu.school} (${edu.years || ""})`);
      }
      y -= 10;
    }

    if (resumeFromDb.jobHistory && resumeFromDb.jobHistory.length > 0) {
      drawText("Job History:");
      for (const job of resumeFromDb.jobHistory) {
        drawText(`${job.title} at ${job.company} (${job.dates || ""})`);
        if (job.responsibilities && job.responsibilities.length > 0) {
          for (const resp of job.responsibilities) {
            drawText(" - " + resp);
          }
        }
        y -= 10;
      }
    }

    if (resumeFromDb.bio) {
      drawText("Bio:");
      drawText(resumeFromDb.bio);
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${resumeId}.pdf`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
