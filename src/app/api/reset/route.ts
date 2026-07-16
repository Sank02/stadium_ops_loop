import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Signals } from '@/lib/sense';

let redis: Redis;
function getRedis() {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

export async function POST() {
  try {
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

    await getRedis().set('signals', JSON.stringify(baselineSignals));
    await getRedis().set('log', JSON.stringify([]));

    return NextResponse.json({ success: true, signals: baselineSignals, history: [] });
  } catch (error: any) {
    console.error("API Reset Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
