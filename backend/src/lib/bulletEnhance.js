import { getClient, MODEL, friendlyAiError } from './aiClient.js';

const BULLET_OPTIONS_TOOL = {
  name: 'submit_bullet_options',
  description: 'Submit 3 improved rewrites of the resume bullet.',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string' },
        description: 'Three distinct improved rewrites of the original bullet, tailored to the job requirements.',
      },
    },
    required: ['options'],
  },
};

// FR-5.2: generate 3 AI-improved options for a bullet, grounded in the job's
// requirements and the resume's own evidence (so it doesn't invent skills).
export async function generateBulletOptions({ bulletText, jobTitle, jobRequirements, resumeEvidence }) {
  const anthropic = getClient();
  let message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        'You rewrite a single resume bullet to be stronger and more tailored to a target job, using only facts ' +
        'already present in the provided resume evidence. Add quantification and impact where the evidence supports ' +
        'it. Never claim a skill, tool, or outcome that is not backed by the evidence — that is a hallucination and ' +
        'is not acceptable, even if it would match the job requirements better.',
      tools: [BULLET_OPTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_bullet_options' },
      messages: [
        {
          role: 'user',
          content:
            `Target job: ${jobTitle || '(untitled role)'}\n` +
            `Job requirements to tailor toward: ${jobRequirements.join(', ') || '(none provided)'}\n\n` +
            `Resume evidence (the only facts you may draw on):\n${resumeEvidence}\n\n` +
            `Original bullet to improve:\n"${bulletText}"`,
        },
      ],
    });
  } catch (err) {
    throw friendlyAiError(err);
  }

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('The model did not return bullet options.');
  return toolUse.input.options || [];
}

// FR-5.2 validation step: flag any option that name-drops a job keyword which
// never appears anywhere in the source resume text (a likely hallucination).
export function flagHallucinations(options, jobKeywords, resumeText) {
  const resumeLower = resumeText.toLowerCase();
  return options.map((text) => {
    const flagged = jobKeywords.some((kw) => {
      const k = kw.toLowerCase().trim();
      if (!k) return false;
      const inOption = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
      const inResume = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(resumeLower);
      return inOption && !inResume;
    });
    return { text, flagged };
  });
}
