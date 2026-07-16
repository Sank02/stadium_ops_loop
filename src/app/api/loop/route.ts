import { NextResponse } from 'next/server';
import { readSignals, perturbSignals, writeSignals } from '@/lib/sense';
import { reason } from '@/lib/reason';
import { verify } from '@/lib/verify';
import { appendToLog, getRecentHistory } from '@/lib/remember';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { forceEvent, testInvalidLocation } = await request.json().catch(() => ({ forceEvent: false, testInvalidLocation: false }));

    // 1. Sense
    const currentSignals = await readSignals();
    const updatedSignals = perturbSignals(currentSignals, forceEvent);
    
    if (testInvalidLocation) {
      updatedSignals.incidents.push({
        id: `inc_test_${Date.now()}`,
        type: "medical_emergency",
        location: "Gate Z",
        reported_by: "test_harness",
        description: "Test incident with invalid location",
        severity: "high"
      });
    }
    
    await writeSignals(updatedSignals);

    // Read Venue Layout
    const venueLayoutPath = path.join(process.cwd(), 'data', 'venue_layout.json');
    const venueLayoutData = await fs.promises.readFile(venueLayoutPath, 'utf-8');
    const venueLayout = JSON.parse(venueLayoutData);

    // Read Recent History
    const recentHistory = await getRecentHistory(3);

    // 2. Reason
    const reasonOutput = await reason(updatedSignals, recentHistory, venueLayout);

    // 3. Verify
    const verifyResult = verify(reasonOutput, venueLayout);

    // 4. Remember
    const logEntry = await appendToLog(updatedSignals, verifyResult);

    // Return the state for the Act stage (dashboard)
    return NextResponse.json({
      signals: updatedSignals,
      recommendation: verifyResult.output,
      verifyPassed: verifyResult.passed,
      verifyReason: verifyResult.reason,
      log: logEntry
    });
  } catch (error: any) {
    console.error("API Loop Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Just return the current state without advancing the loop
  try {
    const signals = await readSignals();
    const history = await getRecentHistory(100);
    return NextResponse.json({
      signals,
      history
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
