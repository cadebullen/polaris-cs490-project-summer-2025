
import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../../../lib/firebaseAdmin";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Firestore helpers
function getFirestoreDb() {
  return getFirestore(getFirebaseAdminApp());
}

export async function POST(req: NextRequest) {
  try {
    const { jobText, editableResume, jobAdId, userId } = await req.json();
    // Get unformatted flag from query params
    const unformatted = req.nextUrl?.searchParams?.get('unformatted');

    if (!jobText || !editableResume) {
      return NextResponse.json({ error: "Missing input data" }, { status: 400 });
    }

    // Mark as processing in Firestore
    if (jobAdId && userId) {
      const db = getFirestoreDb();
      await db.collection("unformattedResumes").doc(`${userId}_${jobAdId}`).set({
        status: "processing",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // 'unformatted' already declared above, do not redeclare
    let prompt = "";
    if (unformatted === 'true') {
      prompt = `You are an expert AI resume writer. Rewrite and enhance the resume below as a professional, ATS-friendly, and achievement-focused plain text resume tailored specifically to the job description provided.

CRITICAL FORMATTING INSTRUCTIONS:
- Return ONLY plain text content - NO JSON, NO markdown, NO code blocks, NO backticks
- Do NOT use any formatting like **bold**, *italic*, or [links]
- Do NOT use bullet points with symbols like • or - 
- Use simple line breaks and spacing for structure
- Use ALL CAPS for section headers (e.g., OBJECTIVE, SKILLS, EDUCATION, EXPERIENCE)
- Use plain text formatting only - this content will be formatted by the application
- THE FINAL RESUME MUST BE UNDER 1900 CHARACTERS (including spaces and line breaks). TRIM, SUMMARIZE, AND REMOVE LESS IMPORTANT DETAILS IF NEEDED.

Content Instructions:
- Use a clear, modern format with section headings
- Start with a strong, tailored summary/objective that references the company and role
- Prioritize and highlight skills, experience, and keywords from the job ad
- Use action verbs and quantify achievements where possible
- Reword and reorganize content to best match the job requirements
- List the most relevant experience first
- Avoid generic statements; use details from the job ad and resume

Here is their original resume:
${JSON.stringify(editableResume, null, 2)}

Here is the job description:
${jobText}`;
    } else {
      prompt = `You are an AI resume generator. Your task is to rewrite and enhance the resume below based on the given job description.\n\nYou must return ONLY valid JSON in the following format:\n{\n  \"emails\": [...],\n  \"phones\": [...],\n  \"objective\": \"...\",\n  \"skills\": [...],\n  \"education\": [...],\n  \"jobHistory\": [...]\n}\n\nSpecific requirements:\n- Tailor the content to better match the job description.\n- Improve grammar and formatting.\n- If any job in \"jobHistory\" is missing a \"Role Summary\", generate a professional Role Summary using the company name and job title.\n- The \"objective\" field must be customized based on the job description.\n- Keep the JSON structure exactly as shown above.\n- Do NOT include markdown, backticks, explanations, or formatting outside the JSON.\n\nHere is their original resume:\n${JSON.stringify(editableResume, null, 2)}\n\nHere is the job description:\n${jobText}`;
    }


    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("[Gemini AI raw response]", raw);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    console.log("[Gemini AI cleaned output]", cleaned);
    // Store the unformatted resume for later GET in Firestore
    if (jobAdId && userId) {
      const db = getFirestoreDb();
      await db.collection("unformattedResumes").doc(`${userId}_${jobAdId}`).set({
        resume: cleaned,
        status: "completed",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // If unformatted flag is set, return the raw text (no JSON parsing)
    if (unformatted === 'true') {
      return NextResponse.json({ resume: cleaned });
    }

    try {
      const parsed = JSON.parse(cleaned);
      // Mark as completed in Firestore (already set above)
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

// Polling endpoint: /api/generateResume?jobAdId=...&userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobAdId = searchParams.get("jobAdId");
    const userId = searchParams.get("userId");
    const unformatted = searchParams.get("unformatted");
    if (!jobAdId || !userId) {
      return NextResponse.json({ error: "Missing jobAdId or userId" }, { status: 400 });
    }
    const db = getFirestoreDb();
    const docRef = db.collection("unformattedResumes").doc(`${userId}_${jobAdId}`);
    const doc = await docRef.get();
    if (unformatted === 'true') {
      if (!doc.exists) {
        return NextResponse.json({ resume: "" });
      }
      const raw = doc.data()?.resume;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return NextResponse.json({ resume: raw });
      } else {
        return NextResponse.json({ resume: "" });
      }
    }
    const status = doc.exists ? doc.data()?.status || 'idle' : 'idle';
    return NextResponse.json({ status });
  } catch (err) {
    console.error("GET /api/generateResume error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}