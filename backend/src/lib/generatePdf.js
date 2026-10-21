import PDFDocument from 'pdfkit';

// FR-6.1: render the structured resume back out as a PDF, with any selected
// bullet improvements substituted in place of the originals. This rebuilds a
// clean one-page document in a classic serif layout: centered name and contact
// line, ruled section headings, and bold/italic entry lines with right-aligned
// dates and locations.

const FONT = { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic' };
const MARGIN = { top: 30, bottom: 28, side: 38 };
const MIN_SCALE = 0.8; // never shrink text below 80% to fit the page

// Skill groups to print: the resume's own categories, or one plain list for
// resumes parsed before categories were kept. Tailored skills may be either.
export function skillGroupsOf(resume) {
  const groups = resume.skillGroups;
  if (Array.isArray(groups) && groups.length && typeof groups[0] === 'object') return groups;
  const flat = Array.isArray(groups) && groups.length ? groups : resume.skills || [];
  return flat.length ? [{ category: '', items: flat }] : [];
}

export function renderResumePdf({ resume, bulletOverrides = new Map(), boldTerms = [] }, res) {
  let scale = 1;
  while (scale > MIN_SCALE && pagesNeeded(resume, bulletOverrides, boldTerms, scale) > 1) scale -= 0.03;

  const doc = newDoc();
  doc.pipe(res);
  draw(doc, resume, bulletOverrides, boldTerms, Math.max(scale, MIN_SCALE));
  doc.end();
}

function newDoc() {
  return new PDFDocument({
    size: 'LETTER',
    bufferPages: true,
    margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.side, right: MARGIN.side },
  });
}

function pagesNeeded(resume, overrides, boldTerms, scale) {
  const doc = newDoc();
  doc.on('data', () => {}); // drain; this pass only measures
  draw(doc, resume, overrides, boldTerms, scale);
  const pages = doc.bufferedPageRange().count;
  doc.end();
  return pages;
}

// Splits text into runs, bolding job keywords and figures (60%, $728/year) the
// way a hand-tailored resume highlights them.
function boldRuns(text, terms) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length).map(escape);
  const figures = String.raw`~?\$?\d+(?:[.,]\d+)*(?:%|\+|[kKmM]\b|\/(?:year|yr|month|mo))?`;
  const re = new RegExp(`(?<![\\w])(${[...words, figures].join('|')})(?![\\w])`, 'gi');
  const runs = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false });
    runs.push({ text: m[0], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs.length ? runs : [{ text, bold: false }];
}

function draw(doc, resume, overrides, boldTerms, s) {
  const left = MARGIN.side;
  const width = doc.page.width - MARGIN.side * 2;
  const size = { name: 26 * s, contact: 9.5 * s, heading: 11.5 * s, entry: 10.5 * s, body: 10 * s };
  const gap = 0.6 * s;

  // Bold left text and a right-aligned counterpart on the same line.
  const twoCol = (leftText, rightText, leftFont, rightFont, fontSize) => {
    const y = doc.y;
    let rightWidth = 0;
    if (rightText) {
      doc.font(rightFont).fontSize(fontSize);
      rightWidth = doc.widthOfString(rightText);
      doc.text(rightText, left, y, { width, align: 'right', lineBreak: false });
    }
    doc.font(leftFont).fontSize(fontSize).text(leftText || '', left, y, { width: width - rightWidth - 12, lineGap: gap });
  };

  const runs = (parts, x, y, w, fontSize) => {
    parts.forEach((p, i) => {
      doc.font(p.font || (p.bold ? FONT.bold : FONT.regular)).fontSize(fontSize);
      const opts = { continued: i < parts.length - 1, lineGap: gap };
      if (i === 0) doc.text(p.text, x, y, { ...opts, width: w });
      else doc.text(p.text, opts);
    });
  };

  const bullet = (parts) => {
    const y = doc.y;
    doc.font(FONT.regular).fontSize(size.body).text('•', left + 8, y, { lineBreak: false });
    runs(parts, left + 18, y, width - 18, size.body);
    doc.y += 0.5 * s;
  };

  const section = (title) => {
    doc.moveDown(0.45);
    doc.font(FONT.bold).fontSize(size.heading).text(title.toUpperCase(), left, doc.y, { width });
    const y = doc.y + 0.5;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.7).strokeColor('#000').stroke();
    doc.y = y + 4 * s;
  };

  doc.fillColor('#000');

  // Header
  const c = resume.contactInfo || {};
  doc.font(FONT.bold).fontSize(size.name).text(c.name || resume.originalFilename || 'Resume', left, MARGIN.top, { width, align: 'center' });
  const contact = [c.phone, c.email, c.location, ...(c.links || [])].filter(Boolean).join('  |  ');
  if (contact) doc.font(FONT.regular).fontSize(size.contact).text(contact, { width, align: 'center' });

  if (resume.summary) {
    section('Summary');
    doc.font(FONT.regular).fontSize(size.body).text(resume.summary, left, doc.y, { width, lineGap: gap });
  }

  if (resume.education?.length) {
    section('Education');
    resume.education.forEach((ed, i) => {
      if (i) doc.moveDown(0.3);
      twoCol(ed.school, ed.dates, FONT.bold, FONT.bold, size.entry);
      const right = ed.gpa ? `GPA: ${ed.gpa}` : ed.location;
      if (ed.degree || right) twoCol(ed.degree, right, FONT.italic, FONT.italic, size.body);
      if (ed.coursework) runs([{ text: 'Relevant Coursework: ', bold: true }, { text: ed.coursework }], left, doc.y, width, size.body);
    });
  }

  const groups = skillGroupsOf(resume);
  if (groups.length) {
    section('Skills');
    for (const g of groups) {
      const items = g.items.join(', ');
      runs(g.category ? [{ text: `${g.category}: `, bold: true }, { text: items }] : [{ text: items }], left, doc.y, width, size.body);
    }
  }

  const entries = (resume.experience || []).map((exp) => ({
    ...exp,
    bullets: (exp.bullets || []).map((b) => overrides.get(b.id) || b.text),
  }));
  const jobs = entries.filter((e) => e.section !== 'projects');
  const projects = entries.filter((e) => e.section === 'projects');

  if (jobs.length) {
    section('Work Experience');
    jobs.forEach((exp, i) => {
      if (i) doc.moveDown(0.35);
      twoCol(exp.company || exp.title, exp.dates, FONT.bold, FONT.bold, size.entry);
      if (exp.company && (exp.title || exp.location)) twoCol(exp.title, exp.location, FONT.italic, FONT.italic, size.body);
      exp.bullets.forEach((text) => bullet(boldRuns(text, boldTerms)));
    });
  }

  if (projects.length) {
    section('Project Experience');
    projects.forEach((exp, i) => {
      if (i) doc.moveDown(0.35);
      twoCol(exp.title || exp.company, exp.dates || exp.company, FONT.bold, FONT.bold, size.entry);
      if (exp.dates && exp.company && exp.title) twoCol(exp.company, exp.location, FONT.italic, FONT.italic, size.body);
      exp.bullets.forEach((text) => bullet(boldRuns(text, boldTerms)));
    });
  }

  if (resume.certifications?.length) {
    section('Certifications');
    for (const cert of resume.certifications) {
      // "Name - Issuer | Date" → bold name, italic issuer.
      const m = cert.match(/^(.*?)\s+[-–—]\s+(.*?)\s*\|\s*(.*)$/);
      bullet(m ? [{ text: m[1], bold: true }, { text: ' - ' }, { text: m[2], font: FONT.italic }, { text: ` | ${m[3]}` }] : [{ text: cert }]);
    }
  }
}

