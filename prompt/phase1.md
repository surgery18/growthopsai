Build Phase 1 of “GrowthOpsAI Client Command Center” as a React app.

Goal:
Create a functional MVP SPA that matches the structure of the provided GrowthOpsAI portal HTML (dashboard, approvals, chat, settings, project details) but implemented cleanly in React with local state + localStorage persistence.

Tech requirements:

- React + Vite (TypeScript preferred but optional)
- Tailwind CSS for styling (match the dark “glass panel” aesthetic)
- React Router (or a simple internal view switcher) to navigate between views
- Use localStorage to persist all app data so refresh keeps state
- No backend required in Phase 1; all data is mocked but functional

Core pages (must implement):

1. Dashboard

- Show “Active Agents” cards (Hunter, Marcus, Nano, Vector) with status + short activity line
- Show an “Approval Queue” preview card with 1 draft item and Approve/Redirect buttons
- Show an “Audit Log” panel with recent events and “waiting for user input…” line
- Include a “Global Kill Switch” button in header; toggles systemPaused state and updates UI

2. Approvals

- List 3 approval items (standard lane + at least one “high risk lane” item)
- Each item has: platform, campaign context, generated content text, optional image placeholder, risk level badge, status
- Approve marks item approved and appends audit log entry
- Redirect opens a modal (radio reasons + optional text) and stores feedback on item + audit log entry

3. Case Manager (Chat)

- Chat UI with messages and a text input
- On send: append user message, then append a simulated AI “routing” response after 600–900ms
- Persist conversation per project in localStorage

4. Settings (Project Portfolio)

- Grid of projects (at least 3 mock projects)
- Each project card shows name, short description, active agents count, status dot
- Clicking “Manage” opens Project Details for that project

5. Project Details

- Context Injection form:
  - Primary Mission textarea
  - Core KPI goal select (Revenue / Signups / Leads)
  - Optional constraints fields (tone, forbidden phrases, compliance flags)
- Agent Staffing toggles (Hunter/Marcus/Nano/Sentinel/etc.) that persist per project
- Asset upload placeholders (no real upload needed; just UI)
- Danger Zone: “Archive Project” button (sets project archived=true and logs event)

Data model (localStorage keys):

- projects: array of {id, name, desc, status, archived, settings, agents}
- approvals: array of {id, projectId, content, platform, campaign, risk, status, feedback[]}
- auditLog: array of {ts, projectId, message, actor}
- chats: map projectId -> messages[]
- systemPaused: boolean

UX requirements:

- When systemPaused is true, disable “Run Scan / Generate / Approve” actions and show a visible paused badge
- Header title updates per current page
- Sidebar nav highlights current page
- Everything should be polished and clickable

Deliverables:

- Provide the full repo code (package.json, vite config, tailwind config, src files)
- Include a short README with run instructions (npm install, npm run dev)
