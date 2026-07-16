import fs from 'fs';
import path from 'path';

const SIGNALS_PATH = path.join(process.cwd(), 'data', 'signals.json');

export interface GateSignal {
  gate_id: string;
  queue_length: number;
  wait_minutes: number;
  capacity: number;
}

export interface ConcessionSignal {
  stand_id: string;
  wait_minutes: number;
}

export interface Incident {
  id: string;
  type: string;
  location: string;
  reported_by: string;
  description: string;
}

export interface Signals {
  timestamp: string;
  gates: GateSignal[];
  concessions: ConcessionSignal[];
  weather: { condition: string; temp_c: number };
  incidents: Incident[];
}

export async function readSignals(): Promise<Signals> {
  const data = await fs.promises.readFile(SIGNALS_PATH, 'utf-8');
  return JSON.parse(data) as Signals;
}

export async function writeSignals(signals: Signals): Promise<void> {
  await fs.promises.writeFile(SIGNALS_PATH, JSON.stringify(signals, null, 2), 'utf-8');
}

export function perturbSignals(signals: Signals, forceEvent: boolean = false, testInvalidLocation: boolean = false): Signals {
  const newSignals = { ...signals };
  newSignals.timestamp = new Date().toISOString();

  // Perturb gates
  newSignals.gates = newSignals.gates.map(gate => {
    // Randomly change queue length by -5% to +10%
    const changeFactor = 0.95 + Math.random() * 0.15;
    let newQueue = Math.floor(gate.queue_length * changeFactor);
    
    // Ensure it doesn't go below 0
    if (newQueue < 0) newQueue = 0;
    
    // Wait minutes is roughly queue_length / (capacity / 60)
    const newWait = Math.ceil(newQueue / (gate.capacity / 60));
    
    return { ...gate, queue_length: newQueue, wait_minutes: newWait };
  });

  // Perturb concessions
  newSignals.concessions = newSignals.concessions.map(stand => {
    // Random change wait time by -2 to +3 minutes
    const change = Math.floor(Math.random() * 6) - 2;
    let newWait = stand.wait_minutes + change;
    if (newWait < 0) newWait = 0;
    return { ...stand, wait_minutes: newWait };
  });

  // Occasionally clear incidents
  if (Math.random() > 0.8 && !forceEvent && !testInvalidLocation) {
    newSignals.incidents = [];
  }

  // Inject event
  if (testInvalidLocation) {
    newSignals.incidents.push({
      id: `inc_test_${Math.floor(Math.random() * 1000)}`,
      type: "crowd_surge",
      location: "Gate Z",
      reported_by: "system_monitor",
      description: "Sudden crowd surge detected at Gate Z (INVALID LOCATION TEST)."
    });
  } else if (forceEvent || (Math.random() > 0.9 && newSignals.incidents.length === 0)) {
    const gates = newSignals.gates;
    const randomGateIndex = Math.floor(Math.random() * gates.length);
    const targetGate = gates[randomGateIndex];
    
    // Simulate a surge at this gate
    targetGate.queue_length += 200;
    targetGate.wait_minutes = Math.ceil(targetGate.queue_length / (targetGate.capacity / 60));
    
    newSignals.incidents.push({
      id: `inc_${Math.floor(Math.random() * 1000)}`,
      type: "crowd_surge",
      location: `${targetGate.gate_id} concourse`,
      reported_by: "system_monitor",
      description: `Sudden crowd surge detected at ${targetGate.gate_id}. Queue increased dramatically.`
    });
  }

  return newSignals;
}
