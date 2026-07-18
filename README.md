# Stadium Ops Loop

An autonomous GenAI agent that continuously monitors simulated FIFA World Cup 2026 stadium conditions and surfaces verified, actionable recommendations to venue staff — before a bottleneck becomes a safety problem.

**Live demo:** [Vercel](https://stadium-ops-loop.vercel.app)

**Chosen challenge:** Challenge 4 — Smart Stadiums & Tournament Operations

---

## Chosen Vertical: Venue Staff & Operations

This solution is designed around **venue staff and stadium operations teams** as the primary persona. Rather than a tool fans query on demand, it's built to run continuously in the background — the way a real operations center works — and hand staff a verified recommendation before they'd think to ask for one.

**Fans are a secondary beneficiary:** every approved recommendation also generates a multilingual public alert (English, Hindi, Marathi), so the same reasoning that helps staff redirect crowds also keeps fans informed in real time.

## Approach & Logic

Instead of a single request/response chatbot, this project uses a continuous **five-stage agent loop**, repeating every 15–30 seconds:

```
Sense → Reason (GenAI) → Act → Verify → Remember → (loop back to Sense)
```

- **Sense** — reads the current simulated stadium signals (gate queues, concession wait times, weather, incidents).
- **Reason** — a Gemini API call analyzes the current signals plus the last 3 cycles of history, returning a structured JSON recommendation (never free-form text).
- **Act** — the dashboard renders the recommendation, its category, and a multilingual alert draft.
- **Verify** — a separate, rule-based gate checks the model's output before it's treated as approved: confidence must be ≥ 0.7, and the target location must exist in the venue's known layout. Anything that fails either check is flagged for human review instead of being silently trusted — regardless of how confident the model sounds.
- **Remember** — the completed cycle (signals, reasoning, verify result) is logged and fed back into the next cycle, so the agent has short-term memory and doesn't repeat or contradict its own recent calls.

This means the system's key safety property isn't "the AI is usually right" — it's "the AI's output is never acted on without passing an independent, non-negotiable check."

## How It Works

1. The loop runs automatically once started, or can be manually triggered for demo purposes.
2. Each cycle calls the Gemini API with a strict system prompt requiring structured JSON output and explicit rules (e.g., never invent a location, flag safety-adjacent situations for human review regardless of confidence).
3. Flagged recommendations require a human "Approve" action before being marked as acted upon — the system never resolves a flagged situation on its own.
4. A manual "Trigger Event" button and a "Test: Invalid Location" button let staff (or a reviewer) force specific scenarios on demand, rather than waiting for randomness.
5. A "Reset Demo Data" button returns the simulation to a calm baseline.

### Tech Stack

- **Frontend/Backend:** Next.js (App Router) + Tailwind CSS
- **LLM:** Gemini API (`gemini-3.1-flash-lite`)
- **Persistent storage:** Upstash Redis (chosen after discovering Vercel's serverless functions have a read-only filesystem — local JSON files work in development but not in production)
- **Testing:** Jest — unit tests for the Verify stage's rule logic and the Reason stage's retry/error-handling branches
- **Deployment:** Vercel

## Assumptions Made

- Stadium signals (queue lengths, wait times, incidents) are **simulated**, not sourced from real IoT sensors or live venue systems — this is explicitly a demonstration of the agent architecture, not a production integration.
- The venue layout (gate names, concession stands, capacities) is a small static dataset defined for this demo, not connected to any real stadium's actual layout data.
- Alerts are drafted in English, Hindi, and Marathi as a demonstration of the multilingual capability; the architecture supports adding any language by extending the system prompt's output schema.
- A free-tier LLM model was used due to hackathon budget constraints; the architecture is model-agnostic and would work with a higher-tier model in a production deployment.
- "Human approval" in this demo updates a status label rather than triggering a real downstream action (e.g., an actual staff dispatch system), since no real staff-facing dispatch system exists to integrate with in this context.

## Running Locally

```bash
npm install
npm run dev
```

Requires the following environment variables in `.env.local`:
```
GEMINI_API_KEY=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

## Testing

```bash
npm test
```

Covers the Verify stage's confidence and location-validation rules, and the Reason stage's retry logic for malformed responses and rate-limit errors.

## Further Reading

A full technical write-up of the build process — including the architectural decisions, bugs encountered, and how each was diagnosed and fixed — is available here: [Blog](https://indigo-ghoul-65e.notion.site/The-Stadium-Ops-Loop-Building-an-Autonomous-GenAI-Agent-for-FIFA-World-Cup-2026-Bugs-Loops-and--3a06b955d969801c8c32d99b022ff3a6)
