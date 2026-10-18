import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export const MODEL = config.anthropicModel; // bullet rewrites
export const PARSE_MODEL = config.anthropicParseModel; // resume + job-posting parsing

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

// Reads the JSON object from a response made with output_config.format
// (structured outputs). We use that instead of forcing a tool call, because
// newer models (e.g. claude-sonnet-5-5) reject tool_choice {type: 'tool'}.
// `what` names the thing being parsed, for the user-facing error.
export function readJsonOutput(message, what) {
  if (message.stop_reason === 'refusal') {
    throw new Error(`The AI couldn’t process this ${what}. Please try again or adjust the text.`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`This ${what} is too long for the AI to process in one go. Try a shorter version.`);
  }
  try {
    return JSON.parse(message.content.find((b) => b.type === 'text')?.text ?? '');
  } catch {
    throw new Error(`The AI returned an unreadable answer for this ${what}. Please try again.`);
  }
}

// NFR-3.2: never surface a raw Anthropic SDK/API error (JSON bodies, status
// codes) to the user — translate it into a plain-English message instead.
export function friendlyAiError(err) {
  if (err?.status === 401 || err?.status === 403) {
    return new Error('The AI service is not configured correctly on the server (invalid API key). Contact the site admin.');
  }
  // Our own deadline (AbortSignal.timeout) or the SDK's per-request timeout.
  // Check before APIConnectionError: the timeout error is a subclass of it.
  if (err instanceof Anthropic.APIUserAbortError || err instanceof Anthropic.APIConnectionTimeoutError) {
    return new Error('The AI service took too long to respond.');
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
