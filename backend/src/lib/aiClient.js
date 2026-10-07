import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export const MODEL = config.anthropicModel;

let client = null;
export function getClient() {
  if (!config.anthropicApiKey || config.anthropicApiKey === 'your-key-here') {
    throw new Error('The AI service is not configured on the server yet.');
  }
  if (!client) {
    client = new Anthropic({
      apiKey: config.anthropicApiKey,
      // NFR-1.4: AI generation should finish within ~15s. The SDK default is
      // 10 minutes; fail sooner so the user can fall back to manual editing.
      timeout: 20_000, // milliseconds
      maxRetries: 1, // retries 429/5xx/network errors once
    });
  }
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
  // APIConnectionError (and its timeout subclass) has no HTTP status.
  if (err?.status >= 500 || err instanceof Anthropic.APIConnectionError) {
    return new Error('The AI service is temporarily unavailable. Please try again shortly.');
  }
  return err instanceof Error && !err.status ? err : new Error('The AI service is temporarily unavailable.');
}
