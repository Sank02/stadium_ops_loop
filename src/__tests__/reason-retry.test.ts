/**
 * Tests for the Reason stage's 429-vs-malformed-JSON retry branching.
 *
 * reason.ts creates a module-level GoogleGenAI singleton at import time.
 * We mock @google/genai so the singleton's generateContent is a jest.fn()
 * we can control from here.
 *
 * Branch A – 429 / quota error  → return rate-limit fallback immediately, NO retry.
 * Branch B – JSON parse error   → catch → single retry attempt.
 *   B1: retry succeeds          → return parsed output from retry.
 *   B2: retry also fails        → return final fallback object.
 */

// jest.mock() factories are hoisted to the TOP of the file by Babel/Jest,
// so we cannot reference module-level `const`/`let` variables inside them.
// Instead we create a stable jest.fn() reference inside the factory itself
// and expose it via a named export on the mock module.
let generateContent: jest.Mock;

jest.mock('@google/genai', () => {
  // This runs at hoist time, before any variable declarations in this file.
  // So we create the mock function here and attach it where callers can read it.
  const gc = jest.fn();
  return {
    __esModule: true,
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: gc },
    })),
    // Expose the shared fn so tests can configure it
    __mockGenerateContent: gc,
  };
});

// After the mock is registered, grab the exposed reference via require.
// Using require (not import) avoids hoisting concerns.
// eslint-disable-next-line @typescript-eslint/no-var-requires
generateContent = require('@google/genai').__mockGenerateContent;

import { reason } from '../lib/reason';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const dummySignals: any = {
  timestamp: new Date().toISOString(),
  gates: [],
  concessions: [],
  weather: { condition: 'clear', temp_c: 22 },
  incidents: [],
};
const dummyHistory: any[] = [];
const dummyLayout: any = { gates: [], concessions: [] };

const validReasoningOutput = {
  recommendation: 'no action needed',
  target_location: null,
  confidence: 0.9,
  reasoning: 'All clear.',
  category: 'none',
  alert_draft: null,
  requires_human_review: false,
};

beforeEach(() => {
  generateContent.mockClear();
});

// ─── Branch A: 429 / quota error ─────────────────────────────────────────────

describe('reason – 429 / quota error branch', () => {
  test('returns rate-limit fallback immediately when error.status is 429', async () => {
    const err429 = Object.assign(new Error('Quota exceeded'), { status: 429 });
    generateContent.mockRejectedValueOnce(err429);

    const result = await reason(dummySignals, dummyHistory, dummyLayout);

    expect(result.requires_human_review).toBe(true);
    expect(result.recommendation).toMatch(/rate limit/i);
    expect(result.confidence).toBe(0);
    // Must have been called exactly once — no retry on 429
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  test('returns rate-limit fallback when error message contains "429"', async () => {
    const errMsg = new Error('Error 429: too many requests');
    generateContent.mockRejectedValueOnce(errMsg);

    const result = await reason(dummySignals, dummyHistory, dummyLayout);

    expect(result.requires_human_review).toBe(true);
    expect(result.recommendation).toMatch(/rate limit/i);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  test('returns rate-limit fallback when error message contains "quota"', async () => {
    const errQuota = new Error('quota exceeded for this project');
    generateContent.mockRejectedValueOnce(errQuota);

    const result = await reason(dummySignals, dummyHistory, dummyLayout);

    expect(result.requires_human_review).toBe(true);
    expect(result.recommendation).toMatch(/rate limit/i);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

// ─── Branch B: malformed JSON / other error → retry ──────────────────────────

describe('reason – malformed JSON retry branch', () => {
  test('retries once on JSON parse error; returns output when retry succeeds', async () => {
    // First call returns non-JSON text → JSON.parse inside reason() throws
    generateContent.mockResolvedValueOnce({ text: 'NOT VALID JSON }{' });
    // Second call (retry) returns valid JSON
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify(validReasoningOutput),
    });

    const result = await reason(dummySignals, dummyHistory, dummyLayout);

    expect(result.recommendation).toBe('no action needed');
    expect(result.confidence).toBe(0.9);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test('returns final fallback when both initial call and retry fail with JSON error', async () => {
    // Both calls return unparseable text
    generateContent.mockResolvedValueOnce({ text: 'GARBAGE' });
    generateContent.mockResolvedValueOnce({ text: 'MORE GARBAGE' });

    const result = await reason(dummySignals, dummyHistory, dummyLayout);

    expect(result.requires_human_review).toBe(true);
    expect(result.recommendation).toMatch(/failed to generate/i);
    expect(result.confidence).toBe(0);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test('retries once on a generic (non-429) API error; returns fallback if retry also throws', async () => {
    const genericError = new Error('Upstream API timeout');
    generateContent.mockRejectedValueOnce(genericError);
    generateContent.mockRejectedValueOnce(new Error('Still failing'));

    const result = await reason(dummySignals, dummyHistory, dummyLayout);

    expect(result.requires_human_review).toBe(true);
    expect(result.recommendation).toMatch(/failed to generate/i);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
