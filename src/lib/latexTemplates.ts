// LaTeX resume templates optimized for local compilation
// Each template has a name, description, and LaTeX content with {{RESUME_CONTENT}} placeholder
export const latexTemplates = [
  {
    name: 'Classic',
    description: 'Clean, traditional layout with bold section headers.',
    content: `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

% Configure section formatting
\\titleformat{\\section*}{\\large\\bfseries}{}{0pt}{}
\\titlespacing*{\\section*}{0pt}{12pt}{6pt}

% Configure itemize spacing
\\setlist[itemize]{leftmargin=*, itemsep=2pt, parsep=0pt, topsep=4pt}

\\pagestyle{empty}
\\begin{document}

{{RESUME_CONTENT}}

\\end{document}`
  },
  {
    name: 'Modern',
    description: 'Modern look with colored section titles.',
    content: `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

% Define colors
\\definecolor{sectioncolor}{RGB}{41,128,185}
\\definecolor{textcolor}{RGB}{64,64,64}

% Configure section formatting
\\titleformat{\\section*}{\\large\\bfseries\\color{sectioncolor}}{}{0pt}{}
\\titlespacing*{\\section*}{0pt}{12pt}{6pt}

% Configure itemize spacing
\\setlist[itemize]{leftmargin=*, itemsep=2pt, parsep=0pt, topsep=4pt}

\\color{textcolor}
\\pagestyle{empty}
\\begin{document}

{{RESUME_CONTENT}}

\\end{document}`
  },
  {
    name: 'Minimalist',
    description: 'Minimal, single-column, no extra formatting.',
    content: `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

% Simple section formatting
\\renewcommand{\\section}[1]{\\vspace{8pt}\\noindent\\textbf{\\large #1}\\vspace{4pt}}

% Configure itemize spacing
\\setlist[itemize]{leftmargin=*, itemsep=1pt, parsep=0pt, topsep=2pt}

\\pagestyle{empty}
\\begin{document}

{{RESUME_CONTENT}}

\\end{document}`
  },
  {
    name: 'Sidebar',
    description: 'Two-column layout with sidebar for contact info.',
    content: `\\documentclass[11pt]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

% Define colors
\\definecolor{sidebarcolor}{RGB}{240,240,240}
\\definecolor{sectioncolor}{RGB}{41,128,185}

% Configure section formatting
\\titleformat{\\section*}{\\large\\bfseries\\color{sectioncolor}}{}{0pt}{}
\\titlespacing*{\\section*}{0pt}{8pt}{4pt}

% Configure itemize spacing
\\setlist[itemize]{leftmargin=*, itemsep=1pt, parsep=0pt, topsep=2pt}

\\pagestyle{empty}
\\begin{document}

\\noindent
\\begin{minipage}[t]{0.3\\textwidth}
\\vspace{0pt}
\\colorbox{sidebarcolor}{\\parbox{\\textwidth}{\\vspace{4pt}
\\textbf{\\large Contact}\\\\[4pt]
Extract contact info from resume content
\\vspace{4pt}}}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.65\\textwidth}
\\vspace{0pt}
{{RESUME_CONTENT}}
\\end{minipage}

\\end{document}`
  },
  {
    name: 'Boxed',
    description: 'Professional layout with subtle borders.',
    content: `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage{xcolor}
\\usepackage{mdframed}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

% Define colors
\\definecolor{bordercolor}{RGB}{200,200,200}
\\definecolor{sectioncolor}{RGB}{41,128,185}

% Configure section formatting
\\titleformat{\\section*}{\\large\\bfseries\\color{sectioncolor}}{}{0pt}{}
\\titlespacing*{\\section*}{0pt}{8pt}{4pt}

% Configure itemize spacing
\\setlist[itemize]{leftmargin=*, itemsep=2pt, parsep=0pt, topsep=4pt}

% Configure frame style
\\mdfdefinestyle{resumebox}{%
  linecolor=bordercolor,
  linewidth=1pt,
  topline=true,
  bottomline=true,
  leftline=true,
  rightline=true,
  innertopmargin=8pt,
  innerbottommargin=8pt,
  innerleftmargin=8pt,
  innerrightmargin=8pt
}

\\pagestyle{empty}
\\begin{document}

\\begin{mdframed}[style=resumebox]
{{RESUME_CONTENT}}
\\end{mdframed}

\\end{document}`
  }
];

// Utility to get template names and descriptions
export function getLatexTemplateSummaries() {
  return latexTemplates.map(t => ({ name: t.name, description: t.description }));
}
