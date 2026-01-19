# GrowthOpsAI – Agent Core Execution (Phase 1A)

## Exec → Manager → Content Writer (Text Only)

You are extending an existing Cloudflare-native system called GrowthOpsAI.
This is NOT a prototype and NOT a chatbot.

Your task is to implement the **core AI company execution loop** up through the
**Content Writer worker**, including all required Executives and Managers.

No UI work is required in this step.
No publishing.
No analytics.
No images.
Text only.

---

## GOAL OF THIS STEP

Make it so a single instruction like:

> “Create a 7-day X posting plan for Grub Vision focusing on motivation and food tracking”

causes the system to:

1. Be interpreted by an **Executive**
2. Broken down by **Managers**
3. Researched and scoped
4. Written by a **Content Writer**
5. Fully logged, auditable, replayable

At the end of this step, we should have:

- a campaign plan
- a post schedule
- draft X post content
- all produced through agent collaboration

---

## ARCHITECTURE (MANDATORY)

### Cloudflare Stack

- Cloudflare Workers (API + glue)
- Cloudflare Workflows (primary execution)
- Durable Objects (run state + locks)
- D1 (system of record)
- R2 (large text artifacts)
- Vectorize (memory / brand grounding)
- AI Search (R2-backed knowledge lookup)

---

## AGENT HIERARCHY (MUST MATCH EXACTLY)

### Executive Layer (Top Authority)

#### 1. Executive Director (Atlas)

Responsibilities:

- Interpret user intent
- Set high-level objectives
- Enforce scope (text-only, X only)
- Decide which Managers are involved
- Approve the campaign direction before execution

Outputs:

- `EXEC_DIRECTIVE`
- success criteria
- risk flags (if any)

---

### Manager Layer (Coordination & Control)

#### 2. Campaign Manager

Responsibilities:

- Convert executive directive into a campaign structure
- Decide:
  - posting cadence
  - content themes
  - number of posts
- Produce a **Campaign Plan**

Outputs:

- `CAMPAIGN_PLAN`
- schedule outline
- required deliverables

---

#### 3. Brand / Compliance Manager

Responsibilities:

- Retrieve brand rules from Vectorize
- Enforce:
  - tone
  - forbidden phrases
  - medical disclaimer rules (Grub Vision specific)
- Annotate constraints for writers

Outputs:

- `BRAND_CONSTRAINTS`
- flagged risks (if any)

---

#### 4. Research Manager

Responsibilities:

- Query AI Search (R2-backed docs)
- Query Vectorize memory
- Provide factual grounding and talking points
- Summarize relevant product features

Outputs:

- `RESEARCH_BRIEF`
- citations (doc keys)
- key angles to use or avoid

---

### Worker Layer (Execution)

#### 5. Content Writer (Worker)

Responsibilities:

- Write X post drafts based on:
  - campaign plan
  - brand constraints
  - research brief
- Produce:
  - post text
  - optional hashtags
  - light CTA
- No emojis unless allowed by brand rules

Outputs:

- `DRAFT_X_POSTS`
- structured per day / per post
- stored as artifacts

---

## EXECUTION FLOW (REQUIRED)

Use **Cloudflare Workflows** to orchestrate this exact sequence:

1. Workflow starts with user instruction
2. Executive Director produces EXEC_DIRECTIVE
3. Campaign Manager produces CAMPAIGN_PLAN
4. Brand Manager produces BRAND_CONSTRAINTS
5. Research Manager produces RESEARCH_BRIEF
6. Content Writer produces DRAFT_X_POSTS
7. Workflow stops (no publishing yet)

Each step must:

- wait for the previous step to complete
- fail loudly if inputs are missing
- emit events

---

## MEMORY & KNOWLEDGE RULES

### Vectorize (Memory)

Must be used by:

- Executive Director
- Brand Manager
- Content Writer

Memory types:

- brand_voice
- do_not_say
- successful_angles
- prior_learnings

Every query:

- log retrieved chunk IDs
- log similarity scores
- attach to step record

---

### AI Search (Knowledge)

Must be used by:

- Research Manager

Sources:

- R2 documents (product docs, FAQs, feature lists)

Must log:

- document keys
- summary of extracted info

---

## DATA PERSISTENCE (NON-NEGOTIABLE)

### D1 Tables (minimum for this step)

- runs
- run_steps
- messages
- artifacts
- events

### Every Step Must Store

- role (exec / manager / worker)
- agent name
- inputs
- outputs
- timestamps
- status
- memory used (Vectorize IDs)
- docs used (AI Search keys)
- estimated token usage

Large text outputs stored in **R2**, with pointers in D1.

---

## EVENTS (MUST EMIT)

Each step emits structured events such as:

- `EXEC_DIRECTIVE_CREATED`
- `CAMPAIGN_PLAN_CREATED`
- `BRAND_CONSTRAINTS_APPLIED`
- `RESEARCH_COMPLETED`
- `CONTENT_DRAFTED`

These events will later drive the UI.

---

## API REQUIREMENTS

Expose at minimum:

- `POST /api/runs`
  - starts the workflow
- `GET /api/runs/:id`
  - returns run state
- `GET /api/runs/:id/artifacts`
  - returns drafts + plans
- `GET /api/runs/:id/events`
  - returns event log

---

## HARD CONSTRAINTS

- Text only
- X posts only
- No publishing
- No analytics
- No UI work
- No mock shortcuts (agents must be real modules)
- No single-agent shortcuts
- No prompt-in-a-loop tricks

This is a **multi-role system**, not a chatbot.

---

## SUCCESS CRITERIA

This step is complete when:

- One instruction produces:
  - a campaign plan
  - a research brief
  - brand-safe X post drafts
- All decisions are visible in logs
- Every agent can be audited independently
- The system feels like a small AI company working together

Output:

- Complete Cloudflare Worker + Workflow code
- Agent modules
- Schema updates (if needed)
- Clear run instructions

Do NOT implement publishing, approvals, or UI in this step.
That comes next.
