import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { tick_id } = await request.json();
    if (!tick_id) {
      return NextResponse.json({ error: "Missing tick_id" }, { status: 400 });
    }

    const LOG_PATH = path.join(process.cwd(), 'data', 'log.json');
    let logs: any[] = [];
    try {
      const data = await fs.promises.readFile(LOG_PATH, 'utf-8');
      logs = JSON.parse(data);
    } catch (err) {
      return NextResponse.json({ error: "Could not read log file" }, { status: 500 });
    }

    const updatedLogs = logs.map(log => {
      if (log.tick_id === tick_id && log.action_taken === "flagged_for_review") {
        return { ...log, action_taken: "approved_by_staff" };
      }
      return log;
    });

    await fs.promises.writeFile(LOG_PATH, JSON.stringify(updatedLogs, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
