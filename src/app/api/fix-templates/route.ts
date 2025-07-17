import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    console.log('Fixing double-escaped LaTeX templates...');
    
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const snapshot = await db.collection('templates').get();
    
    if (snapshot.empty) {
      return NextResponse.json({ error: 'No templates found' }, { status: 404 });
    }

    const fixes: Array<{id: string, name: string, fixed: boolean, reason?: string}> = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const templateId = doc.id;
      
      console.log(`Fixing template: ${data.name} (${templateId})`);
      console.log('Original content preview:', data.content?.substring(0, 100));
      
      if (data.content && typeof data.content === 'string') {
        let fixedContent = data.content;
        
        console.log('Before fixing - raw content length:', fixedContent.length);
        console.log('Before fixing - quadruple backslashes count:', (fixedContent.match(/\\\\\\\\/g) || []).length);
        
        // Only fix quadruple backslashes (extreme over-escaping) by reducing them to double
        if ((fixedContent.match(/\\\\\\\\/g) || []).length > 0) {
          fixedContent = fixedContent.replace(/\\\\\\\\/g, '\\\\');
          console.log('Fixed quadruple backslashes to double backslashes');
        }
        
        // Fix broken LaTeX commands that lost their leading backslash
        // These specific commands should have single backslashes in LaTeX source
        const brokenCommands = [
          'documentclass', 'usepackage', 'begin', 'end', 'section', 'subsection', 
          'item', 'textbf', 'textit', 'Large', 'large', 'vspace', 'hspace', 
          'newline', 'pagebreak', 'pagestyle', 'setstretch', 'setlength', 'parskip',
          'hypersetup', 'definecolor'
        ];
        
        for (const command of brokenCommands) {
          // Fix commands that have no leading backslash (most broken case)
          const noBackslashPattern = new RegExp(`(^|[^\\\\])${command}\\{`, 'g');
          if (fixedContent.match(noBackslashPattern)) {
            fixedContent = fixedContent.replace(noBackslashPattern, `$1\\${command}{`);
            console.log(`Fixed missing backslash for command: ${command}`);
          }
        }
        
        // Fix special titlesec commands that need the backslash restored
        const titleCommands = [
          'titleformat', 'titlespacing', 'titlerule'
        ];
        
        for (const command of titleCommands) {
          // Fix commands that have no leading backslash (standalone occurrence)
          const standalonePattern = new RegExp(`(^|\\n|\\s)${command}\\{`, 'g');
          if (fixedContent.match(standalonePattern)) {
            fixedContent = fixedContent.replace(standalonePattern, `$1\\${command}{`);
            console.log(`Fixed missing backslash for title command: ${command}`);
          }
          
          // Also fix commands with special characters after them
          const specialPattern = new RegExp(`(^|\\n|\\s)${command}\\*\\{`, 'g');
          if (fixedContent.match(specialPattern)) {
            fixedContent = fixedContent.replace(specialPattern, `$1\\${command}*{`);
            console.log(`Fixed missing backslash for title command with *: ${command}`);
          }
        }
        
        console.log('After fixing - content preview:', fixedContent.substring(0, 100));
        console.log('After fixing - quadruple backslashes count:', (fixedContent.match(/\\\\\\\\/g) || []).length);
        console.log('After fixing - double backslashes count:', (fixedContent.match(/\\\\/g) || []).length);
        
        // Update the document with the fixed content
        await doc.ref.update({
          content: fixedContent
        });
        
        fixes.push({
          id: templateId,
          name: data.name,
          fixed: true
        });
        
        console.log(`✅ Fixed template: ${data.name}`);
      } else {
        fixes.push({
          id: templateId,
          name: data.name,
          fixed: false,
          reason: 'No valid content'
        });
        console.log(`⚠️ Skipping template ${data.name} - no valid content`);
      }
    }
    
    console.log('🎉 All templates have been processed!');
    
    return NextResponse.json({ 
      message: 'Templates fixed successfully',
      fixes 
    });
    
  } catch (error) {
    console.error('Error fixing templates:', error);
    return NextResponse.json({ 
      error: 'Failed to fix templates', 
      details: String(error) 
    }, { status: 500 });
  }
}
