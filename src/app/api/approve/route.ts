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
    const { tick_id } = await request.json();
    if (!tick_id) {
      return NextResponse.json({ error: "Missing tick_id" }, { status: 400 });
    }

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
