import { NextResponse } from 'next/server';
import { readSignals, perturbSignals, writeSignals } from '@/lib/sense';
import { reason } from '@/lib/reason';
import { verify } from '@/lib/verify';
import { appendToLog, getRecentHistory } from '@/lib/remember';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    // --- Input validation ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body !== null && typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;

    if ('forceEvent' in raw && typeof raw.forceEvent !== 'boolean') {
      return NextResponse.json({ error: 'forceEvent must be a boolean' }, { status: 400 });
    }
    if ('testInvalidLocation' in raw && typeof raw.testInvalidLocation !== 'boolean') {
      return NextResponse.json({ error: 'testInvalidLocation must be a boolean' }, { status: 400 });
    }

    const forceEvent = (raw.forceEvent as boolean | undefined) ?? false;
    const testInvalidLocation = (raw.testInvalidLocation as boolean | undefined) ?? false;
    // --- End input validation ---

    // 1. Sense
    const currentSignals = await readSignals();
    const updatedSignals = perturbSignals(currentSignals, forceEvent);
    
    if (testInvalidLocation) {
      const testIncident = {
        id: "inc_test_invalid_location",
        type: "medical_emergency",
        location: "Gate Z",
        reported_by: "test_harness",
        description: "Test incident with invalid location"
      };
      // Remove it if it exists so we can move it to the top
      updatedSignals.incidents = updatedSignals.incidents.filter(i => i.id !== testIncident.id);
      updatedSignals.incidents.unshift(testIncident);
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
  } catch (error: unknown) {
    console.error("API Loop Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
  } catch (error: unknown) {
    console.error("API Loop GET Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

