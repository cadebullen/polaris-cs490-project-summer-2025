import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebaseAdmin';
import { auth } from 'firebase-admin';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(request: NextRequest) {
  console.log('Advice API POST called');
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { jobId, resumeId } = await request.json();

    if (!jobId || !resumeId) {
      return NextResponse.json({ error: 'Missing jobId or resumeId' }, { status: 400 });
    }

    // Fetch job ad data from the correct nested collection
    const jobDoc = await db.collection('users').doc(userId).collection('jobAds').doc(jobId).get();
    if (!jobDoc.exists) {
      return NextResponse.json({ error: 'Job ad not found' }, { status: 404 });
    }
    const jobData = jobDoc.data();

    // Fetch resume data
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    if (!resumeDoc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
    const resumeData = resumeDoc.data();

    // Verify ownership
    if (jobData?.userId !== userId || resumeData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // Generate AI-powered personalized advice using Gemini
    const advice = await generateAIAdvice(jobData, resumeData);

    return NextResponse.json({ advice });
  } catch (error) {
    console.error('Error generating advice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateAIAdvice(jobData: any, resumeData: any) {
  try {
    // Construct the job description text
    const jobDescription = [
      jobData.jobText || '',
      jobData.title ? `Title: ${jobData.title}` : '',
      jobData.company ? `Company: ${jobData.company}` : '',
      jobData.location ? `Location: ${jobData.location}` : '',
      jobData.pay ? `Pay: ${jobData.pay}` : '',
      jobData.overview ? `Overview: ${jobData.overview}` : '',
      jobData.expectations ? `Expectations: ${jobData.expectations}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `You are an expert career advisor and resume consultant. Analyze the resume and job posting below to provide specific, actionable advice for improving the candidate's application.

Instructions:
- Provide 3-6 specific, actionable recommendations
- Focus on gaps between the resume and job requirements
- Suggest concrete improvements for skills, experience, keywords, and presentation
- Include advice on customization for this specific role and company
- Use bullet points with emojis for better readability
- Be encouraging but honest about areas for improvement
- Prioritize the most impactful changes first

Job Posting:
${jobDescription}

Current Resume:
${JSON.stringify(resumeData, null, 2)}

Please provide your advice as a JSON array of strings, where each string is a specific recommendation. Format like this:
["🎯 **Recommendation 1**: Specific advice here...", "💼 **Recommendation 2**: Another specific tip..."]`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!geminiRes.ok) {
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("[Gemini AI advice response]", raw);
    
    // Clean up the response and parse JSON
    const cleaned = raw.replace(/```json|```/g, "").trim();
    
    try {
      const adviceArray = JSON.parse(cleaned);
      if (Array.isArray(adviceArray)) {
        return adviceArray;
      } else {
        // If not an array, try to extract advice from the text
        return [cleaned];
      }
    } catch (parseErr) {
      console.error("Failed to parse Gemini advice response:", cleaned);
      // Fallback: split by lines and filter out empty ones
      const lines = cleaned.split('\n').filter((line: string) => line.trim().length > 0);
      return lines.length > 0 ? lines : ["💡 **General Advice**: Consider tailoring your resume more closely to this specific job posting by highlighting relevant skills and experience."];
    }
  } catch (error) {
    console.error('Error calling Gemini API for advice:', error);
    // Fallback to basic advice if AI fails
    return generateFallbackAdvice(jobData, resumeData);
  }
}

function generateFallbackAdvice(jobData: any, resumeData: any) {
  const advice: string[] = [];
  
  // Extract basic job information
  const jobTitle = jobData.title?.toLowerCase() || '';
  const jobCompany = jobData.company || '';
  
  // Basic advice when AI is unavailable
  advice.push("🎯 **Skill Alignment**: Review the job posting carefully and ensure your resume highlights the specific skills and technologies mentioned.");
  
  if (jobCompany) {
    advice.push(`🏢 **Company Research**: Customize your objective/summary to mention ${jobCompany} specifically and show your interest in their mission.`);
  }
  
  advice.push("💼 **Experience Focus**: Reorder your work experience to prioritize roles most relevant to this position.");
  advice.push("🔍 **Keyword Optimization**: Include key terms from the job posting throughout your resume to improve ATS compatibility.");
  advice.push("📊 **Quantify Results**: Add specific numbers, percentages, or measurable outcomes to your accomplishments where possible.");
  advice.push("💡 **Pro Tip**: Write a compelling cover letter that tells your unique story and explains why you're passionate about this specific role and company.");
  
  return advice;
}
