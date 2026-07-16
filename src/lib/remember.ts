import fs from 'fs';
import path from 'path';
import { VerifyResult } from './verify';
import { Signals } from './sense';

const LOG_PATH = path.join(process.cwd(), 'data', 'log.json');

export interface LogEntry {
  tick_id: number;
  timestamp: string;
  signal_snapshot: Signals;
  reasoning_output: any; // using any to bypass strict checks here, could use ReasoningOutput
  verify_result: { passed: boolean; reason?: string };
  action_taken: string;
}

export async function readLog(): Promise<LogEntry[]> {
  try {
    const data = await fs.promises.readFile(LOG_PATH, 'utf-8');
    return JSON.parse(data) as LogEntry[];
  } catch (err) {
    // Return empty array if file doesn't exist or is empty
    return [];
  }
}

export async function writeLog(entries: LogEntry[]): Promise<void> {
  // Keep only the most recent 100 entries to prevent infinite growth
  const trimmed = entries.slice(-100);
  await fs.promises.writeFile(LOG_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');
}

export async function appendToLog(
  signals: Signals,
  verifyResult: VerifyResult
): Promise<LogEntry> {
  const currentLog = await readLog();
  const nextTickId = currentLog.length > 0 ? currentLog[currentLog.length - 1].tick_id + 1 : 1;
  
  const entry: LogEntry = {
    tick_id: nextTickId,
    timestamp: new Date().toISOString(),
    signal_snapshot: signals,
    reasoning_output: verifyResult.output,
    verify_result: { 
      passed: verifyResult.passed, 
      reason: verifyResult.reason 
    },
    action_taken: verifyResult.output.requires_human_review ? "flagged_for_review" : "shown_to_staff"
  };

  currentLog.push(entry);
  await writeLog(currentLog);
  
  return entry;
}

export async function getRecentHistory(limit: number = 3): Promise<LogEntry[]> {
  const currentLog = await readLog();
  return currentLog.slice(-limit);
}
