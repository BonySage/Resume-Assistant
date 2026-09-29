import { getClient, MODEL, friendlyAiError } from './aiClient.js';

// FR-2.2: parse extracted resume text into structured sections. Bullets get a
// stable id (expN-bM) so the frontend can reference a specific bullet for
// FR-5.1 selection without re-sending its full text.
const RESUME_STRUCTURE_TOOL = {
  name: 'submit_resume_structure',
  description: 'Submit the resume parsed into structured sections.',
  input_schema: {
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
          required: ['title', 'bullets'],
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
        },
      },
    },
    required: ['skills', 'experience'],
  },
};

export async function parseResumeStructure(resumeText) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system:
        'You parse raw resume text into structured JSON. Copy bullet text verbatim (exact substrings of the input) ' +
        'so it can be located programmatically — do not paraphrase or summarize bullets.',
      tools: [RESUME_STRUCTURE_TOOL],
      tool_choice: { type: 'tool', name: 'submit_resume_structure' },
      messages: [{ role: 'user', content: `Resume text:\n\n---\n${resumeText}\n---` }],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('The model did not return a structured resume.');
  const raw = toolUse.input;

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
