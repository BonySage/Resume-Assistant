import { getClient, PARSE_MODEL, friendlyAiError, readJsonOutput } from './aiClient.js';

// FR-2.2: parse extracted resume text into structured sections. Bullets get a
// stable id (expN-bM) so the frontend can reference a specific bullet for
// FR-5.1 selection without re-sending its full text.
//
// Projects live in `experience` too (with section: "projects"), so every
// bullet has one id scheme and matching/tailoring treat them alike. `skills`
// is the flat list used for matching; `skillGroups` keeps the resume's own
// categories for export.
//
// Structured outputs need additionalProperties: false on every object, so every
// field is required and the model uses "" / [] when the resume lacks it.
const RESUME_STRUCTURE_SCHEMA = {
  type: 'object',
  properties: {
    contactInfo: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        location: { type: 'string' },
        links: { type: 'array', items: { type: 'string' }, description: 'LinkedIn, GitHub, portfolio URLs, as written.' },
      },
      required: ['name', 'email', 'phone', 'location', 'links'],
      additionalProperties: false,
    },
    summary: { type: 'string', description: 'The resume summary/objective statement, if present.' },
    skillGroups: {
      type: 'array',
      description: 'Skills grouped by the resume’s own category labels. Use one group with category "" if the resume does not categorize them.',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
        required: ['category', 'items'],
        additionalProperties: false,
      },
    },
    experience: {
      type: 'array',
      description: 'Jobs and projects, in the order they appear.',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string', enum: ['experience', 'projects'], description: '"projects" for entries under a projects heading.' },
          title: {
            type: 'string',
            description:
              'Job title. For a project, the whole header text copied exactly as written (e.g. "<Name> — <Subtitle>" or ' +
              '"<Name> | <Tech>", whichever parts the resume shows), never adding words that are not there.',
          },
          company: {
            type: 'string',
            description: 'Employer. For a project, only text shown apart from the header (e.g. a course name on the right), otherwise "".',
          },
          location: { type: 'string' },
          dates: { type: 'string' },
          bullets: {
            type: 'array',
            items: { type: 'string', description: 'Exact bullet text copied verbatim from the resume.' },
          },
        },
        required: ['section', 'title', 'company', 'location', 'dates', 'bullets'],
        additionalProperties: false,
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          school: { type: 'string' },
          degree: { type: 'string' },
          location: { type: 'string' },
          dates: { type: 'string' },
          gpa: { type: 'string', description: 'As written, e.g. "4.0".' },
          coursework: { type: 'string', description: 'Relevant coursework line, without its label.' },
        },
        required: ['school', 'degree', 'location', 'dates', 'gpa', 'coursework'],
        additionalProperties: false,
      },
    },
    certifications: {
      type: 'array',
      items: { type: 'string', description: 'One certification line as written, e.g. "Developing AI Applications - IBM | May 2026".' },
    },
  },
  required: ['contactInfo', 'summary', 'skillGroups', 'experience', 'education', 'certifications'],
  additionalProperties: false,
};

export async function parseResumeStructure(resumeText) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create({
      model: PARSE_MODEL,
      max_tokens: 8192,
      // Extraction, not reasoning: low effort keeps upload processing fast (NFR-1.1).
      output_config: { effort: 'low', format: { type: 'json_schema', schema: RESUME_STRUCTURE_SCHEMA } },
      system:
        'You parse raw resume text into structured JSON. Copy bullet text verbatim (exact substrings of the input) ' +
        'so it can be located programmatically — do not paraphrase or summarize bullets. ' +
        'Use an empty string or empty list for anything the resume does not contain.',
      messages: [{ role: 'user', content: `Resume text:\n\n---\n${resumeText}\n---` }],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }

  const raw = readJsonOutput(message, 'resume');

  // PDF text extraction breaks long bullets across lines, while the model
  // returns each bullet on one line, so compare with whitespace collapsed.
  const collapse = (s) => s.replace(/\s+/g, ' ').trim();
  const source = collapse(resumeText);
  const cleanBullet = (s) => collapse(s).replace(/^[•●▪◦‣∙·*–-]\s*/, '');
  const str = (s) => (typeof s === 'string' ? s.trim() : '');

  const experience = (raw.experience || []).map((exp, i) => ({
    section: exp.section === 'projects' ? 'projects' : 'experience',
    title: str(exp.title),
    company: str(exp.company),
    location: str(exp.location),
    dates: str(exp.dates),
    bullets: (exp.bullets || [])
      .filter((text) => typeof text === 'string')
      .map(cleanBullet)
      .filter((text) => text && source.includes(text))
      .map((text, j) => ({ id: `exp${i}-b${j}`, text })),
  }));

  const skillGroups = (raw.skillGroups || [])
    .map((g) => ({ category: str(g.category), items: (g.items || []).map(str).filter(Boolean) }))
    .filter((g) => g.items.length);

  return {
    contactInfo: { ...raw.contactInfo, links: (raw.contactInfo?.links || []).map(str).filter(Boolean) },
    summary: raw.summary || '',
    skills: skillGroups.flatMap((g) => g.items),
    skillGroups,
    experience,
    education: raw.education || [],
    certifications: (raw.certifications || []).map(str).filter(Boolean),
  };
}
