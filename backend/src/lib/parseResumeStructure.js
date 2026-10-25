import { getClient, PARSE_MODEL, friendlyAiError, readJsonOutput } from './aiClient.js';

// FR-2.2: parse extracted resume text into structured sections. Bullets get a
// stable id (expN-bM) so the frontend can reference a specific bullet for
// FR-5.1 selection without re-sending its full text.
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
      },
      required: ['name', 'email', 'phone', 'location'],
      additionalProperties: false,
    },
    summary: { type: 'string', description: 'The resume summary/objective statement, if present.' },
    skills: { type: 'array', items: { type: 'string' } },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          dates: { type: 'string' },
          bullets: {
            type: 'array',
            items: { type: 'string', description: 'Exact bullet text copied verbatim from the resume.' },
          },
        },
        required: ['title', 'company', 'dates', 'bullets'],
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
          dates: { type: 'string' },
        },
        required: ['school', 'degree', 'dates'],
        additionalProperties: false,
      },
    },
  },
  required: ['contactInfo', 'summary', 'skills', 'experience', 'education'],
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

  const experience = (raw.experience || []).map((exp, i) => ({
    title: exp.title || '',
    company: exp.company || '',
    dates: exp.dates || '',
    bullets: (exp.bullets || [])
      .filter((text) => typeof text === 'string' && resumeText.includes(text))
      .map((text, j) => ({ id: `exp${i}-b${j}`, text })),
  }));

  return {
    contactInfo: raw.contactInfo || {},
    summary: raw.summary || '',
    skills: raw.skills || [],
    experience,
    education: raw.education || [],
  };
}
