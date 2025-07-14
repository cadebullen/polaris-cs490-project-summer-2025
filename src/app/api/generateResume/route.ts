import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Temporary in-memory status store (for demo; replace with DB or persistent store in production)
const resumeStatus: { [key: string]: 'processing' | 'completed' } = {};
// Store unformatted resume text for each user/jobAd
const resumeRawText: { [key: string]: string } = {};

export async function POST(req: NextRequest) {
  try {
    const { jobText, editableResume, jobAdId, userId } = await req.json();

    if (!jobText || !editableResume) {
      return NextResponse.json({ error: "Missing input data" }, { status: 400 });
    }

    // Mark as processing
    if (jobAdId && userId) {
      resumeStatus[`${userId}_${jobAdId}`] = 'processing';
    }

    const prompt = `
You are an AI resume generator. Your task is to rewrite and enhance the resume below based on the given job description.

You must return ONLY valid JSON in the following format:
{
  "emails": [...],
  "phones": [...],
  "objective": "...",
  "skills": [...],
  "education": [...],
  "jobHistory": [...]
}

Specific requirements:
- Tailor the content to better match the job description.
- Improve grammar and formatting.
- If any job in "jobHistory" is missing a "Role Summary", generate a professional Role Summary using the company name and job title.
- The "objective" field must be customized based on the job description.
- Keep the JSON structure exactly as shown above.
- Do NOT include markdown, backticks, explanations, or formatting outside the JSON.

Here is their original resume:
${JSON.stringify(editableResume, null, 2)}

Here is the job description:
${jobText}
`;


    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    // Store the unformatted resume for later GET
    if (jobAdId && userId) {
      resumeRawText[`${userId}_${jobAdId}`] = cleaned;
    }

    // If the user only wants unformatted resume text (not JSON), allow a query param or flag
    const unformatted = req.nextUrl?.searchParams?.get('unformatted');

    // If unformatted flag is set, return the raw text (no JSON parsing)
    if (unformatted === 'true') {
      if (jobAdId && userId) {
        resumeStatus[`${userId}_${jobAdId}`] = 'completed';
      }
      return NextResponse.json({ resume: cleaned });
    }

    try {
      const parsed = JSON.parse(cleaned);
      // Mark as completed
      if (jobAdId && userId) {
        resumeStatus[`${userId}_${jobAdId}`] = 'completed';
      }
      return NextResponse.json({ resume: parsed });
    } catch (err) {
      console.error("Failed to parse Gemini response:", raw);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  } catch (err) {
    console.error("POST /api/generateResume error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Polling endpoint: /api/generateResume?jobAdId=...&userId=...
  const { searchParams } = new URL(req.url);
  const jobAdId = searchParams.get("jobAdId");
  const userId = searchParams.get("userId");
  const unformatted = searchParams.get("unformatted");
  if (!jobAdId || !userId) {
    return NextResponse.json({ error: "Missing jobAdId or userId" }, { status: 400 });
  }
  if (unformatted === 'true') {
    const raw = resumeRawText[`${userId}_${jobAdId}`] || "";
    return NextResponse.json({ resume: raw });
  }
  const status = resumeStatus[`${userId}_${jobAdId}`] || 'idle';
  return NextResponse.json({ status });
}