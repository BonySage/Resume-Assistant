import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

let client = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('The AI service is not configured on the server yet.');
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// NFR-3.2: never surface a raw Anthropic SDK/API error (JSON bodies, status
// codes) to the user — translate it into a plain-English message instead.
export function friendlyAiError(err) {
  if (err?.status === 401 || err?.status === 403) {
    return new Error('The AI service is not configured correctly on the server (invalid API key). Contact the site admin.');
  }
  if (err?.status === 429) {
    return new Error('The AI service is busy right now. Please try again in a moment.');
  }
  if (err?.status >= 500 || err?.name === 'APIConnectionError') {
    return new Error('The AI service is temporarily unavailable. Please try again shortly.');
  }
  return err instanceof Error && !err.status ? err : new Error('The AI service is temporarily unavailable.');
}
