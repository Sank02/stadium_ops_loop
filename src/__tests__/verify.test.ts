import { verify } from '../lib/verify';
import type { ReasoningOutput } from '../lib/reason';

// ─── Shared test fixtures ────────────────────────────────────────────────────

const venueLayout = {
  gates: [
    { id: 'Gate A', name: 'North Gate', capacity_per_hour: 5000 },
    { id: 'Gate B', name: 'East Gate', capacity_per_hour: 5000 },
  ],
  concessions: [
    { id: 'Concession F1', name: 'Burger Stand F1', location: 'Section 101' },
  ],
};

function makeOutput(overrides: Partial<ReasoningOutput> = {}): ReasoningOutput {
  return {
    recommendation: 'no action needed',
    target_location: null,
    confidence: 0.9,
    reasoning: 'Signals look fine.',
    category: 'none',
    alert_draft: null,
    requires_human_review: false,
    ...overrides,
  };
}

// ─── Confidence threshold ─────────────────────────────────────────────────────

describe('verify – confidence threshold', () => {
  test('confidence exactly 0.7 passes', () => {
    const result = verify(makeOutput({ confidence: 0.7 }), venueLayout);
    expect(result.passed).toBe(true);
  });

  test('confidence above 0.7 passes', () => {
    const result = verify(makeOutput({ confidence: 0.85 }), venueLayout);
    expect(result.passed).toBe(true);
  });

  test('confidence below 0.7 fails and sets requires_human_review', () => {
    const result = verify(makeOutput({ confidence: 0.69 }), venueLayout);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/0\.69/);
    expect(result.reason).toMatch(/0\.7/);
    expect(result.output.requires_human_review).toBe(true);
  });

  test('confidence of 0 fails', () => {
    const result = verify(makeOutput({ confidence: 0 }), venueLayout);
    expect(result.passed).toBe(false);
    expect(result.output.requires_human_review).toBe(true);
  });
});

// ─── Location validation ──────────────────────────────────────────────────────

describe('verify – location validation', () => {
  test('null target_location skips location check and passes', () => {
    const result = verify(makeOutput({ target_location: null }), venueLayout);
    expect(result.passed).toBe(true);
  });

  test('valid gate ID passes', () => {
    const result = verify(makeOutput({ target_location: 'Gate A' }), venueLayout);
    expect(result.passed).toBe(true);
  });

  test('valid concession ID passes', () => {
    const result = verify(makeOutput({ target_location: 'Concession F1' }), venueLayout);
    expect(result.passed).toBe(true);
  });

  test('invalid/unknown location fails and sets requires_human_review', () => {
    const result = verify(makeOutput({ target_location: 'Gate Z' }), venueLayout);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/Gate Z/);
    expect(result.output.requires_human_review).toBe(true);
  });

  test('requires_human_review=true on input returns failed immediately (short-circuit)', () => {
    const result = verify(
      makeOutput({ requires_human_review: true, confidence: 0.95 }),
      venueLayout,
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/requires_human_review/);
  });
});
