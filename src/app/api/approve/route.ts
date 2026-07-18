import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

let redis: Redis;
function getRedis() {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

export async function POST(request: Request) {
  try {
    // --- Input validation ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const tick_id = raw.tick_id;

    if (tick_id === undefined || tick_id === null) {
      return NextResponse.json({ error: "Missing tick_id" }, { status: 400 });
    }
    if (typeof tick_id !== 'string' && typeof tick_id !== 'number') {
      return NextResponse.json({ error: "tick_id must be a string or number" }, { status: 400 });
    }
    // --- End input validation ---

    let logs: any[] = [];
    try {
      const data = await getRedis().get<any>('log');
      if (typeof data === 'string') {
        logs = JSON.parse(data);
      } else {
        logs = data || [];
      }
    } catch (err) {
      return NextResponse.json({ error: "Could not read log file" }, { status: 500 });
    }

    const updatedLogs = logs.map(log => {
      if (log && log.tick_id === tick_id && log.action_taken === "flagged_for_review") {
        return { ...log, action_taken: "approved_by_staff" };
      }
      return log;
    });

    await getRedis().set('log', JSON.stringify(updatedLogs));
    
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("API Approve Error:", err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
