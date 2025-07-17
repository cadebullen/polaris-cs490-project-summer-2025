// import { NextRequest, NextResponse } from "next/server";
// import latex from "node-latex";
// import { getStorage } from "firebase-admin/storage";
// import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";
// import { v4 as uuidv4 } from "uuid";
// import fs from "fs";
// import fsp from "fs/promises";
// import path from "path";


// export async function POST(req: NextRequest) {
//   try {
//     const { latexSource, userId } = await req.json();
//     if (!latexSource || !userId) {
//       return NextResponse.json({ error: "Missing latexSource or userId" }, { status: 400 });
//     }

//     // Ensure latexSource is a string
//     const input = Buffer.from(String(latexSource), "utf-8");
//     const pdfStream = (latex as any)(input);
//     const chunks: Buffer[] = [];
//     for await (const chunk of pdfStream) {
//       chunks.push(chunk as Buffer);
//     }
//     const pdfBuffer = Buffer.concat(chunks);

//     // Upload to Firebase Storage
//     const app = getFirebaseAdminApp();
//     const storage = getStorage(app);
//     const bucket = storage.bucket();
//     const fileName = `resumes/${userId}/${uuidv4()}.pdf`;
//     const file = bucket.file(fileName);
//     await file.save(pdfBuffer, { contentType: "application/pdf" });
//     await file.makePublic(); // For public access; use signed URLs for privacy

//     const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
//     return NextResponse.json({ downloadUrl });
//   } catch (error) {
//     console.error("PDF generation/upload error:", error);
//     return NextResponse.json({ error: "Failed to generate or upload PDF" }, { status: 500 });
//   }
// }
import { NextRequest, NextResponse } from "next/server";
import latex from "node-latex";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";

export async function POST(req: NextRequest) {
  try {
    const { latexSource, userId } = await req.json();
    if (!latexSource || !userId) {
      return NextResponse.json({ error: "Missing latexSource or userId" }, { status: 400 });
    }

    // --- Create a temp directory ---
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "resume_"));

    // --- Write LaTeX source to temp file ---
    const texPath = path.join(tmpDir, "resume.tex");
    await fsp.writeFile(texPath, String(latexSource), "utf-8");

    // --- Copy resume.cls into temp directory (if it exists) ---
    const clsSourcePath = path.resolve(process.cwd(), "latex-templates", "resume.cls");
    try {
      await fsp.copyFile(clsSourcePath, path.join(tmpDir, "resume.cls"));
    } catch (err) {
      // If resume.cls doesn't exist, ignore (for article class templates)
    }

    // --- Compile LaTeX to PDF using node-latex ---
    const input = fs.createReadStream(texPath);
    const pdfPath = path.join(tmpDir, "resume.pdf");
    const output = fs.createWriteStream(pdfPath);
    const pdfStream = latex(input, { inputs: [tmpDir] });

    pdfStream.pipe(output);

    await new Promise((resolve, reject) => {
      pdfStream.on("error", reject);
      output.on("finish", resolve);
      // pdfStream.on("finish", resolve);
    });

    const pdfBuffer = await fsp.readFile(pdfPath);

    // --- Upload to Firebase Storage ---
    const app = getFirebaseAdminApp();
    const storage = getStorage(app);
    const bucket = storage.bucket();
    const fileName = `resumes/${userId}/${uuidv4()}.pdf`;
    const file = bucket.file(fileName);
    await file.save(pdfBuffer, { contentType: "application/pdf" });
    await file.makePublic(); // For public access; use signed URLs for privacy

    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("PDF generation/upload error:", error);
    return NextResponse.json({ error: "Failed to generate or upload PDF" }, { status: 500 });
  }
}