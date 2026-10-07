import PDFDocument from 'pdfkit';

const INK = '#111318';
const MUTED = '#667085';

// FR-6.1: render the structured resume back out as a PDF, with any selected
// bullet improvements substituted in place of the originals. This rebuilds a
// clean document rather than editing the original file's own layout.
export function renderResumePdf({ resume, bulletOverrides = new Map() }, res) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 54, left: 54, right: 54 } });
  doc.pipe(res);

  const name = resume.contactInfo?.name || resume.originalFilename || 'Resume';
  doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(name);

  const contactLine = [resume.contactInfo?.email, resume.contactInfo?.phone, resume.contactInfo?.location]
    .filter(Boolean)
    .join('  ·  ');
  if (contactLine) {
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(contactLine);
  }
  doc.moveDown(0.8);

  if (resume.summary) {
    section(doc, 'Summary');
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(resume.summary, { lineGap: 2 });
    doc.moveDown(0.6);
  }

  if (resume.experience?.length) {
    section(doc, 'Experience');
    for (const exp of resume.experience) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text([exp.title, exp.company].filter(Boolean).join(' — '));
      if (exp.dates) doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(exp.dates);
      doc.moveDown(0.2);
      for (const bullet of exp.bullets || []) {
        const text = bulletOverrides.get(bullet.id) || bullet.text;
        doc.font('Helvetica').fontSize(10).fillColor(INK).text(`•  ${text}`, { lineGap: 2, indent: 8 });
      }
      doc.moveDown(0.5);
    }
  }

  if (resume.skills?.length) {
    section(doc, 'Skills');
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(resume.skills.join(', '), { lineGap: 2 });
    doc.moveDown(0.6);
  }

  if (resume.education?.length) {
    section(doc, 'Education');
    for (const edu of resume.education) {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text([edu.degree, edu.school].filter(Boolean).join(', '));
      if (edu.dates) doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(edu.dates);
      doc.moveDown(0.3);
    }
  }

  doc.end();
}

function section(doc, title) {
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(INK).text(title.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.2);
}
