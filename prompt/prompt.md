# GrowthOpsAI – Phase 2 (Post-Phase1 Integration)

## Command Center + AI Org Wiring

You have already completed Phase 1 using Cloudflare-native tooling:

- Workers, Durable Objects, Workflows
- D1, R2, Vectorize, AI Search
- Executive / Manager / Worker AI architecture
- Text-only X-post generation for Grub Vision

This prompt is Phase 2 **continuation**, not a restart.

Your task is to **integrate the Phase 1 AI system into the provided GrowthOpsAI Command Center dashboard structure** and make the UI reflect _real AI orchestration state_, not mock data.

---

## INPUTS YOU MUST RESPECT

### 1. Existing Dashboard Structure (DO NOT REDESIGN)

You are given an HTML reference for the Command Center UI:

- Sidebar sections (Dashboard, Case Manager, My Team, Orchestration, Approvals, Events, Growth, Brand Bible, Billing, Settings)
- Visual metaphors:
  - “Agents” as staff members
  - Approval Queue
  - Audit Log / SYSTEM.LOG
  - Case Manager chat
  - Org chart (Executives → Managers → Workers)

**Do not change the mental model or layout.**
Your job is to **connect it to the AI system**, not invent a new UI.

(Reference UI comes from `growthopsai.html` :contentReference[oaicite:0]{index=0})

---

### 2. Phase 1 Architecture Is Canon

Phase 1 already established:

- Cloudflare Workflows as the execution engine
- Durable Objects for run state + locks
- Exec / Manager / Worker agents
- Vectorize for memory
- AI Search (R2-backed) for documents
- D1 as the system of record

(Reference spec comes from `phase1.md` :contentReference[oaicite:1]{index=1})

You **must not collapse this into a single agent or chatbot**.

---

## OBJECTIVE OF THIS PROMPT

Turn the Command Center into a **live window into the AI company**.

The dashboard should now:

- reflect _real run state_
- reflect _real agent activity_
- reflect _real approval gates_
- reflect _real back-and-forth between AI roles_

Still **text-only** and **X posts only**.

---

## WHAT TO BUILD

### 1. Replace Mock UI State with Real API Wiring

The dashboard should consume data from the Phase 1 backend:

#### Dashboard

- “Active Agents” cards reflect:
  - current agent state from D1 / events
  - last task message
- Approval Queue pulls from:
  - `artifacts` where status = `WAITING_APPROVAL`
- Audit Log streams from:
  - `events` table (append-only)

#### Approvals

- Approve → `POST /api/runs/:runId/approve`
- Redirect → writes feedback → Manager re-dispatches Worker revision

#### Case Manager (Chat)

- Messages go to:
  - Executive Director agent
- Executive decides:
  - which Manager(s) to notify
- Responses are **not instant chat replies**:
  - they are **logged delegations**
  - visible as system + agent messages

This is _command-and-control_, not ChatGPT.

---

### 2. Explicit Org Role Mapping (Critical)

Map UI personas to real agents:

#### Executive Layer

- Atlas → Executive Director (final authority)
- Nexus → Program Director (workflow coordinator)

#### Manager Layer

- Elena → Campaign Manager
- Marcus → Creative Director
- Sentinel → Brand / Compliance Manager

#### Worker Layer

- Scribe → Copy Worker
- Editor → Revision Worker
- Publisher → X Publisher Worker
- Analyst → Performance Worker

Each UI “agent” **must map to a real role** in the system.

---

### 3. Workflow ↔ UI Contract

Each Workflow execution must emit structured events such as:

- `EXEC_DECISION`
- `MANAGER_ASSIGNMENT`
- `WORKER_OUTPUT`
- `REVISION_REQUESTED`
- `APPROVAL_REQUIRED`
- `APPROVED`
- `PUBLISHED`
- `ANALYSIS_COMPLETE`

The UI:

- does NOT infer
- does NOT simulate
- only renders what actually happened

---

### 4. Approval Lanes Become Real

Map approval lanes to policy:

- Fast Lane → fully_auto
- Standard Lane → approve_before_publish
- High Risk Lane → approve_every_step

Sentinel can:

- auto-block
- force redirect
- escalate to Executive

---

### 5. Orchestration View (New Behavior)

The “Orchestration” page should show:

- Workflow graph (static is fine)
- Current step highlighted
- Retry counts
- Waiting states
- Kill switch state (global pause)

Global Kill Switch:

- pauses Workflows
- blocks tool execution
- visually freezes agents

---

### 6. Brand Bible ↔ Vectorize

Brand Bible UI edits:

- update Vectorize memory
- versioned
- future runs must retrieve latest brand constraints

---

### 7. Growth & ROI (Still Mock Metrics, Real Flow)

Metrics can still be simulated, but:

- must come from Analyst Worker
- must be stored
- must influence next run suggestions

---

## NON-GOALS (DO NOT BUILD YET)

- No TikTok
- No images
- No real X API
- No billing logic
- No multi-tenant auth
- No public marketing site

---

## DELIVERABLES

- Update backend endpoints where needed
- Provide frontend wiring logic (React or vanilla, consistent with Phase 1 plan)
- Clearly document:
  - event → UI mapping
  - agent → UI mapping
- Preserve the “AI company” illusion at all times

This phase succeeds if:

> A user can **watch an AI company operate**, intervene when needed, and approve outputs — without ever feeling like they’re “prompting a bot”.

That feeling matters more than polish.
