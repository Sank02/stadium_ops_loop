import { ReasoningOutput } from './reason';

export interface VerifyResult {
  passed: boolean;
  reason?: string;
  output: ReasoningOutput;
}

export function verify(output: ReasoningOutput, venueLayout: any): VerifyResult {
  // If the LLM already flagged it, just return it as flagged
  if (output.requires_human_review) {
    return {
      passed: false,
      reason: "Flagged by Reason stage (requires_human_review=true)",
      output
    };
  }

  // 1. Check confidence
  if (output.confidence < 0.7) {
    return {
      passed: false,
      reason: `Confidence ${output.confidence} is below threshold 0.7`,
      output: { ...output, requires_human_review: true }
    };
  }

  // 2. Check target_location
  if (output.target_location !== null) {
    let locationExists = false;
    
    // Check gates
    if (venueLayout.gates && Array.isArray(venueLayout.gates)) {
      if (venueLayout.gates.some((g: any) => g.id === output.target_location)) {
        locationExists = true;
      }
    }
    
    // Check concessions
    if (!locationExists && venueLayout.concessions && Array.isArray(venueLayout.concessions)) {
      if (venueLayout.concessions.some((c: any) => c.id === output.target_location)) {
        locationExists = true;
      }
    }
    
    if (!locationExists) {
      return {
        passed: false,
        reason: `Target location '${output.target_location}' not found in venue_layout`,
        output: { ...output, requires_human_review: true }
      };
    }
  }

  return {
    passed: true,
    output
  };
}
