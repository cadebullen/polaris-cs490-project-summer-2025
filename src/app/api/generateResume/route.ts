
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
      prompt = `You are an expert AI resume writer. Rewrite and enhance the resume below as a professional, ATS-friendly, and achievement-focused plain text resume tailored specifically to the job description provided.\n\nInstructions:\n- Use a clear, modern format with section headings (e.g., Objective, Skills, Education, Experience).\n- Start with a strong, tailored summary/objective that references the company and role.\n- Prioritize and highlight skills, experience, and keywords from the job ad.\n- Use action verbs and quantify achievements where possible.\n- Reword and reorganize content to best match the job requirements.\n- List the most relevant experience first.\n- Avoid generic statements; use details from the job ad and resume.\n- Do NOT use JSON, markdown, or code formatting.\n\nHere is their original resume:\n${JSON.stringify(editableResume, null, 2)}\n\nHere is the job description:\n${jobText}`;
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
    const raw = doc.exists ? doc.data()?.resume || "" : "";
    return NextResponse.json({ resume: raw });
  }
  const status = doc.exists ? doc.data()?.status || 'idle' : 'idle';
  return NextResponse.json({ status });
}