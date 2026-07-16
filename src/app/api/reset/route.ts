import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Signals } from '@/lib/sense';

export async function POST() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    // Baseline signals
    const baselineSignals: Signals = {
      timestamp: new Date().toISOString(),
      gates: [
        { gate_id: "Gate A", queue_length: 45, wait_minutes: 5, capacity: 400 },
        { gate_id: "Gate B", queue_length: 60, wait_minutes: 8, capacity: 400 },
        { gate_id: "Gate C", queue_length: 30, wait_minutes: 4, capacity: 400 },
        { gate_id: "Gate D", queue_length: 50, wait_minutes: 6, capacity: 400 }
      ],
      concessions: [
        { stand_id: "Concession F1", wait_minutes: 3 },
        { stand_id: "Concession F12", wait_minutes: 5 }
      ],
      weather: {
        condition: "clear",
        temp_c: 24
      },
      incidents: []
    };

    await fs.promises.writeFile(
      path.join(dataDir, 'signals.json'), 
      JSON.stringify(baselineSignals, null, 2)
    );

    await fs.promises.writeFile(
      path.join(dataDir, 'log.json'), 
      JSON.stringify([], null, 2)
    );

    return NextResponse.json({ success: true, signals: baselineSignals, history: [] });
  } catch (error: any) {
    console.error("API Reset Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
