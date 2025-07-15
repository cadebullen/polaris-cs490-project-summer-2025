import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    // Ensure Firebase Admin is initialized
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const snapshot = await db.collection('templates').get();
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json({ templates: [], error: 'Failed to load templates.' }, { status: 500 });
  }
}
