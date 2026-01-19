-- Migration number: 0001 2026-01-20T00:00:00.000Z
-- Consolidated schema (pre-deploy refactor)
PRAGMA foreign_keys = ON;

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT DEFAULT 'demo-org',
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  website_url TEXT,
  status TEXT DEFAULT 'DRAFT',
  archived INTEGER DEFAULT 0,
  settings TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'idle',
  activity TEXT,
  progress INTEGER DEFAULT 0,
  last_updated INTEGER
);

CREATE TABLE approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  type TEXT,
  content TEXT,
  platform TEXT,
  risk TEXT DEFAULT 'low',
  status TEXT DEFAULT 'pending',
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT,
  timestamp INTEGER,
  project_id INTEGER
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  role TEXT,
  content TEXT,
  timestamp INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  start_time INTEGER,
  end_time INTEGER,
  result TEXT,
  project_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE run_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  input TEXT,
  output TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  name TEXT NOT NULL,
  do_id TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  content TEXT NOT NULL,
  current_version_hash TEXT,
  platform TEXT,
  scheduled_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE post_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  version_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  reason TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE client_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  version_hash TEXT NOT NULL,
  client_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE publish_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  version_hash TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  scheduled_for INTEGER,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  external_post_id TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  priority TEXT DEFAULT 'NORMAL',
  campaign_id INTEGER,
  post_id INTEGER,
  description TEXT,
  payload TEXT,
  assigned_to TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE project_intake_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id INTEGER NOT NULL,
  version_num INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  data_json TEXT,
  ai_context_pack_json TEXT,
  ai_summary TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at INTEGER,
  activated_at INTEGER,
  workflow_id TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  intake_version_id TEXT,
  file_kind TEXT,
  filename TEXT,
  mime_type TEXT,
  r2_key TEXT,
  size_bytes INTEGER,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (intake_version_id) REFERENCES project_intake_versions(id)
);

CREATE TABLE project_knowledge (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  company_name TEXT,
  product_description TEXT,
  brand_voice TEXT,
  target_audience TEXT,
  competitors TEXT,
  approved_claims TEXT,
  disallowed_claims TEXT,
  compliance_rules TEXT,
  platforms_enabled TEXT,
  last_indexed_at INTEGER,
  version INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  source TEXT,
  project_id INTEGER,
  run_id TEXT,
  metadata TEXT
);

CREATE TABLE event_scans (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING',
  search_params_json TEXT,
  iteration_count INTEGER DEFAULT 0,
  total_events_found INTEGER DEFAULT 0,
  workflow_id TEXT,
  error_message TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE discovered_events (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  event_date TEXT,
  location TEXT,
  distance TEXT,
  source_url TEXT,
  source_name TEXT,
  relevance_score INTEGER,
  relevance_reasoning TEXT,
  event_type TEXT,
  status TEXT DEFAULT 'NEW',
  raw_data_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scan_id) REFERENCES event_scans(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TRIGGER trg_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_posts_updated_at
AFTER UPDATE ON posts
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_publish_jobs_updated_at
AFTER UPDATE ON publish_jobs
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE publish_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_tasks_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_project_intake_versions_updated_at
AFTER UPDATE ON project_intake_versions
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE project_intake_versions
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER trg_project_knowledge_updated_at
AFTER UPDATE ON project_knowledge
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE project_knowledge SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER trg_discovered_events_updated_at
AFTER UPDATE ON discovered_events
FOR EACH ROW
WHEN NEW.updated_at == OLD.updated_at
BEGIN
  UPDATE discovered_events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_org_updated_at ON projects(org_id, updated_at DESC);

CREATE INDEX idx_agents_status ON agents(status);

CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_project_id ON approvals(project_id);
CREATE INDEX idx_approvals_status_created_at ON approvals(status, created_at DESC);

CREATE INDEX idx_audit_log_lookup ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_project_id ON audit_log(project_id);
CREATE INDEX idx_audit_log_project_timestamp ON audit_log(project_id, timestamp DESC);

CREATE INDEX idx_messages_project_id ON messages(project_id);

CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_project_id ON runs(project_id);
CREATE INDEX idx_runs_start_time ON runs(start_time DESC);

CREATE INDEX idx_run_steps_run_id ON run_steps(run_id, created_at);
CREATE INDEX idx_run_steps_status ON run_steps(status);
CREATE INDEX idx_run_steps_created_at ON run_steps(created_at DESC);

CREATE INDEX idx_campaigns_project_id ON campaigns(project_id);
CREATE INDEX idx_campaigns_project_name ON campaigns(project_id, name);
CREATE INDEX idx_campaigns_project_created_at ON campaigns(project_id, created_at DESC);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE UNIQUE INDEX idx_campaigns_do_id ON campaigns(do_id);

CREATE INDEX idx_posts_campaign_status_created ON posts(campaign_id, status, created_at DESC);
CREATE INDEX idx_posts_status ON posts(status);

CREATE INDEX idx_post_revisions_post_id ON post_revisions(post_id);

CREATE INDEX idx_client_approvals_post_id ON client_approvals(post_id);

CREATE INDEX idx_publish_jobs_status ON publish_jobs(status);
CREATE INDEX idx_publish_jobs_campaign_id ON publish_jobs(campaign_id);
CREATE INDEX idx_publish_jobs_post_id ON publish_jobs(post_id);

CREATE INDEX idx_tasks_campaign_id ON tasks(campaign_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_post_id ON tasks(post_id);

CREATE UNIQUE INDEX idx_intake_versions_project_version_unique ON project_intake_versions(project_id, version_num);
CREATE INDEX idx_intake_versions_project_status_version ON project_intake_versions(project_id, status, version_num DESC);
CREATE INDEX idx_intake_versions_project_version ON project_intake_versions(project_id, version_num DESC);

CREATE INDEX idx_project_files_project_id ON project_files(project_id, created_at DESC);
CREATE INDEX idx_project_files_intake_version_id ON project_files(intake_version_id);

CREATE UNIQUE INDEX idx_project_knowledge_project_id ON project_knowledge(project_id);
CREATE INDEX idx_project_knowledge_updated_at ON project_knowledge(updated_at);

CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_project_id ON usage_events(project_id);
CREATE INDEX idx_usage_events_model ON usage_events(model);

CREATE INDEX idx_event_scans_project_id ON event_scans(project_id);
CREATE INDEX idx_event_scans_status ON event_scans(status);
CREATE INDEX idx_event_scans_project_created_at ON event_scans(project_id, created_at DESC);

CREATE INDEX idx_discovered_events_scan_id ON discovered_events(scan_id);
CREATE INDEX idx_discovered_events_project_id ON discovered_events(project_id);
CREATE INDEX idx_discovered_events_status ON discovered_events(status);
CREATE INDEX idx_discovered_events_relevance ON discovered_events(relevance_score DESC);
CREATE INDEX idx_discovered_events_project_status_relevance ON discovered_events(project_id, status, relevance_score DESC);
CREATE INDEX idx_discovered_events_project_relevance ON discovered_events(project_id, relevance_score DESC);
