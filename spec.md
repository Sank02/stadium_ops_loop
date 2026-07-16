# Stadium Ops Loop — Project Spec

## 1. Problem & Goal
Large stadium events (e.g. FIFA World Cup 2026 venues) usually catch crowd bottlenecks only
after they're visible — a gate queue that's already 20 minutes long, a concession line that's
already spilling into a concourse. By then, staff are reacting, not preventing.

**Goal:** build a GenAI agent that runs in a continuous loop — sensing simulated stadium
conditions, reasoning about emerging issues, and surfacing *verified* recommendations to
staff — before a problem becomes a visible bottleneck.

## 2. Definition of Done
- [ ] The loop runs on a fixed interval (15–30s) without manual triggering.
- [ ] Each tick produces a schema-valid, structured recommendation (or "no action needed").
- [ ] Low-confidence or unverifiable recommendations are flagged for human review, not
      auto-approved.
- [ ] The loop has memory: it doesn't repeat an identical call tick after tick, and history
      survives an app restart.
- [ ] A dashboard shows: live signals, current recommendation, category, multilingual alert
      draft, and a log/history view.
- [ ] Deployed with a public live-preview URL.

## 3. Architecture: The Loop
Five stages, repeating every tick:

`Sense → Reason (GenAI) → Act → Verify → Remember → (loop back to Sense)`

- **Sense** — read the current mock signal snapshot.
- **Reason** — one LLM call per tick, given the snapshot + recent history, returns a
  structured JSON recommendation.
- **Act** — dashboard renders the recommendation and a multilingual alert draft.
- **Verify** — rule-based gate checks the LLM output before it's shown as "approved."
- **Remember** — the tick's full record (signals + output + verify result) is logged and
  fed back into the next Reason call.

## 4. Data Schemas

**signals.json** (Sense input, regenerated each tick)
```json
{
  "timestamp": "2026-07-07T18:32:00Z",
  "gates": [
    { "gate_id": "C", "queue_length": 340, "wait_minutes": 18, "capacity": 400 }
  ],
  "concessions": [
    { "stand_id": "F12", "wait_minutes": 9 }
  ],
  "weather": { "condition": "clear", "temp_c": 24 },
  "incidents": [
    { "id": "inc_08", "type": "crowd_surge", "location": "Gate C concourse",
      "reported_by": "volunteer_04", "description": "Fans backing up near ticket check" }
  ]
}
```

**reasoning_output.json** (Reason output — the LLM must return exactly this shape)
```json
{
  "recommendation": "Redirect arriving fans from Gate C to Gate D",
  "target_location": "Gate D",
  "confidence": 0.82,
  "reasoning": "Gate C queue is at 85% capacity and rising; Gate D is at 40%.",
  "category": "crowd_management",
  "alert_draft": {
    "en": "Gate C is busy — Gate D has shorter lines right now.",
    "es": "La Puerta C está ocupada — la Puerta D tiene filas más cortas ahora.",
    "fr": "La Porte C est encombrée — la Porte D a des files plus courtes."
  },
  "requires_human_review": false
}
```

**log_entry.json** (Remember output, appended every tick)
```json
{
  "tick_id": 42,
  "timestamp": "2026-07-07T18:32:05Z",
  "signal_snapshot": { "...": "..." },
  "reasoning_output": { "...": "..." },
  "verify_result": { "passed": true, "reason": "confidence 0.82 > threshold 0.7" },
  "action_taken": "shown_to_staff"
}
```

## 5. Stage-by-Stage Requirements

### 5.1 Sense
- Read mock signals from `data/signals.json`.
- A generator script perturbs values slightly every tick and occasionally injects an
  "event" (a surge, a gate closure) so the demo has something to react to.
- **Acceptance:** signals refresh automatically on the dashboard without a page reload.

### 5.2 Reason
- One LLM call per tick: current signal snapshot + last 3 log entries as short-term memory.
- Must return valid JSON matching `reasoning_output` — if malformed, retry once, then
  fall back to `requires_human_review: true`.
- **Acceptance:** 10 consecutive ticks return valid, schema-conformant JSON.

### 5.3 Act
- Dashboard shows: latest recommendation, its category tag, and the multilingual alert
  with a language switcher.
- **Acceptance:** a new recommendation is visible within 2 seconds of the tick completing.

### 5.4 Verify
Rule checks applied to every Reason output before it's shown as "approved":
1. `confidence >= 0.7`
2. `target_location` must exist in the venue's known gate/concession list (blocks
   hallucinated locations)

If either check fails: `requires_human_review = true`, and the dashboard shows it with a
visibly different (amber) state instead of hiding it.
- **Acceptance:** a deliberately low-confidence or bogus-location test input gets flagged,
  never silently auto-approved.

### 5.5 Remember
- Append every tick's full record to `data/log.json`.
- Feed the last 3 entries back into the next Reason call.
- **Acceptance:** restarting the app preserves history — the loop doesn't "forget" and
  repeat an action.

## 6. Tech Stack
- **Frontend:** Next.js + Tailwind CSS
- **Loop runner:** a Next.js API route triggered on a client-side interval (simplest for
  a demo — no separate backend needed)
- **LLM:** Gemini API (native to Antigravity); Claude API is a drop-in alternative
- **Storage:** local JSON files (`data/signals.json`, `data/log.json`) — enough for a
  hackathon demo, no database required
- **Deployment:** Vercel, for a public live-preview URL

## 7. Out of Scope (on purpose)
- Real IoT/sensor integration
- User authentication / multi-venue support
- Production-grade security hardening
- Actually sending SMS/push notifications (draft text only, for the demo)

## 8. Demo Script (for judges)
1. Show the baseline dashboard — quiet stadium, "no action needed."
2. Trigger an injected event (e.g. surge at Gate C).
3. Watch one full loop tick: Sense picks it up → Reason proposes a reroute → Verify
   approves or flags it → Act updates the dashboard and alert.
4. Open the history/log view to show it remembers past actions and doesn't repeat itself.
