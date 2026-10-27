CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE schema_migration_segment (
  version INTEGER NOT NULL,
  segment INTEGER NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (version, segment)
);

CREATE TABLE context_slots (
  session_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  PRIMARY KEY (session_id, key),
  FOREIGN KEY (session_id) REFERENCES "sessions"(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE "session_budgets" (
  session_id TEXT PRIMARY KEY,
  soft_cap_usd REAL NOT NULL, on_exceed TEXT NOT NULL DEFAULT 'pause' CHECK (on_exceed IN ('pause', 'warn')),
  FOREIGN KEY (session_id) REFERENCES "sessions"(id) ON DELETE CASCADE
);

CREATE TABLE permission_audit_retry (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE turn_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES "sessions"(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES "agents"(id) ON DELETE CASCADE
);

CREATE TABLE context_slot_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('user', 'summarizer')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES "sessions"(id) ON DELETE CASCADE
);

CREATE TABLE "project_scripts" (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES "projects"(id) ON DELETE CASCADE
);

CREATE TABLE provider_credentials (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  label TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  default_provider_id TEXT,
  default_branch_prefix TEXT,
  default_verbosity TEXT CHECK (default_verbosity IN ('brief', 'normal', 'verbose')),
  provider_bindings TEXT,
  task_models TEXT,
  role_models TEXT,
  parallel_agents INTEGER,
  provider_pool TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  disconnected_at INTEGER,
  last_accessed_at INTEGER
, attribution_footer INTEGER, reply_voice TEXT CHECK (reply_voice IS NULL OR reply_voice IN ('terse', 'friendly', 'formal', 'mine')), reply_style_note TEXT, reply_template_fixed TEXT, reply_template_no_change TEXT, resolve_on_github INTEGER, resolve_commit_style TEXT CHECK (resolve_commit_style IS NULL OR resolve_commit_style IN ('new', 'fixup')), default_permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions'
  CHECK (default_permission_mode IN ('plan', 'default', 'dontAsk', 'acceptEdits', 'bypassPermissions')), after_merge TEXT
  CHECK (after_merge IS NULL OR after_merge IN ('ask', 'local', 'local-and-origin')), default_branch_template TEXT, workflow_rules TEXT);

CREATE TABLE "projects" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  default_provider_id TEXT,
  default_branch_prefix TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  disconnected_at INTEGER,
  default_verbosity TEXT CHECK (default_verbosity IN ('brief', 'normal', 'verbose')),
  last_accessed_at INTEGER,
  provider_bindings TEXT,
  parallel_agents INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('repo', 'folder')),
  task_models TEXT,
  role_models TEXT,
  provider_pool TEXT, base_branch TEXT, attribution_footer INTEGER, starred_at INTEGER, description TEXT, reply_voice TEXT CHECK (reply_voice IS NULL OR reply_voice IN ('terse', 'friendly', 'formal', 'mine')), reply_style_note TEXT, reply_template_fixed TEXT, reply_template_no_change TEXT, resolve_on_github INTEGER, resolve_commit_style TEXT CHECK (resolve_commit_style IS NULL OR resolve_commit_style IN ('new', 'fixup')), goodboy_ignore TEXT CHECK (goodboy_ignore IN ('existing', 'this-mac', 'project', 'global')), goodboy_ignore_source TEXT, goodboy_ignore_checked_at INTEGER, root_commit TEXT, remote_url TEXT, identity_checked_at INTEGER, after_merge TEXT
  CHECK (after_merge IS NULL OR after_merge IN ('ask', 'local', 'local-and-origin')), default_branch_template TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE "messages" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE "diff_comments" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'consumed')) DEFAULT 'open',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  consumed_at INTEGER,
  consumed_by_agent_id TEXT,
  line_number INTEGER,
  line_side TEXT CHECK (line_side IN ('old', 'new')),
  end_line_number INTEGER, author_kind TEXT NOT NULL DEFAULT 'user' CHECK (author_kind IN ('user', 'agent')), author_agent_id TEXT, project_id TEXT, branch TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (consumed_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE TABLE "workflows" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  is_preset INTEGER NOT NULL DEFAULT 1,
  goal TEXT,
  process_text TEXT,
  origin TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE "steps" (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  library_step_id TEXT,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_override TEXT,
  model_override TEXT,
  effort TEXT,
  verbosity TEXT,
  deleted_at INTEGER,
  role TEXT,
  expected_output TEXT,
  orchestrator_reason TEXT, routing_lock TEXT DEFAULT NULL CHECK (routing_lock IS NULL OR json_valid(routing_lock)), routing_decision TEXT DEFAULT NULL CHECK (routing_decision IS NULL OR json_valid(routing_decision)), task_profile TEXT DEFAULT NULL CHECK (task_profile IS NULL OR json_valid(task_profile)), size TEXT CHECK (size IS NULL OR size IN ('small', 'medium', 'large')),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (library_step_id) REFERENCES step_library(id) ON DELETE SET NULL
);

CREATE TABLE "step_library" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  role TEXT NOT NULL DEFAULT 'custom',
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_default TEXT,
  model_default TEXT,
  effort_default TEXT,
  verbosity_default TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER, expected_output TEXT, base_step_id TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE "session_workflows" (
  workflow_run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  current_step_ordinal INTEGER NOT NULL DEFAULT 0,
  auto_run INTEGER NOT NULL DEFAULT 0,
  discarded_at INTEGER,
  created_at INTEGER NOT NULL,
  goal TEXT,
  trigger_mode TEXT NOT NULL DEFAULT 'immediate',
  chain_after_run_id TEXT,
  execution_mode TEXT NOT NULL DEFAULT 'static',
  orchestration_outcome TEXT,
  orchestration_error TEXT,
  orchestration_reason TEXT,
  orchestrator_provider TEXT,
  orchestrator_model TEXT,
  orchestrator_effort TEXT,
  orchestration_stop_kind TEXT NOT NULL DEFAULT 'failure',
  orchestrator_summary TEXT,
  spend_limit_usd REAL,
  spend_limit_mode TEXT NOT NULL DEFAULT 'pause',
  orchestrator_hint_log TEXT, title TEXT, title_user_edited INTEGER NOT NULL DEFAULT 0, provider_pool TEXT, rules_snapshot TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (chain_after_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

CREATE TABLE "agents" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  step_id TEXT,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_run_id TEXT,
  output_summary TEXT,
  started_at INTEGER,
  provider_session_id TEXT,
  last_finished_at INTEGER,
  last_viewed_at INTEGER,
  deleted_at INTEGER,
  verbosity TEXT,
  effort TEXT,
  model_override TEXT,
  provider_override TEXT,
  kind TEXT,
  parent_agent_id TEXT,
  workflow_run_id TEXT,
  source_thread_id TEXT,
  source_comment_url TEXT,
  source_kind TEXT,
  done_at INTEGER,
  source_thread_ids TEXT,
  domains_json TEXT,
  provider_session_provider_id TEXT, routing_lock TEXT DEFAULT NULL CHECK (routing_lock IS NULL OR json_valid(routing_lock)), routing_decision TEXT DEFAULT NULL CHECK (routing_decision IS NULL OR json_valid(routing_decision)), task_profile TEXT DEFAULT NULL CHECK (task_profile IS NULL OR json_valid(task_profile)), stopped_at INTEGER, stopped_by TEXT, mount_id TEXT REFERENCES session_worktrees(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

CREATE TABLE "budget_rules" (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly')),
  cap_usd REAL NOT NULL,
  alert_threshold_pct REAL NOT NULL DEFAULT 80,
  extra_tokens_budget INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE "budget_alerts" (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('provider-threshold','provider-exceeded','session-threshold','session-exceeded')),
  provider TEXT,
  session_id TEXT,
  current_usd REAL NOT NULL,
  cap_usd REAL NOT NULL,
  created_at INTEGER NOT NULL,
  dismissed_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "github_pr_cache" (
  branch TEXT NOT NULL,
  repo_slug TEXT NOT NULL,
  pr_json TEXT,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (repo_slug, branch)
);

CREATE TABLE "notifications" (
  id TEXT PRIMARY KEY NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  session_id TEXT,
  workspace_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  action TEXT, coalesce_key TEXT, acted_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

CREATE TABLE "nudge_events" (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  context_json TEXT,
  outcome TEXT,
  outcome_ts INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "permission_rules" (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','project','session','global')),
  workspace_id TEXT,
  project_id TEXT,
  session_id TEXT,
  pattern_tool TEXT NOT NULL,
  pattern_args_matcher TEXT,
  decision TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "permission_audit_log" (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool_use_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  decision TEXT NOT NULL,
  rule_id TEXT,
  decided_by TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  decided_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES permission_rules(id) ON DELETE SET NULL
);

CREATE TABLE "pr_review_drafts" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  path TEXT NOT NULL,
  line INTEGER NOT NULL,
  start_line INTEGER,
  side TEXT NOT NULL DEFAULT 'new',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  origin TEXT NOT NULL DEFAULT 'agent',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "skills" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, name)
);

CREATE TABLE "provider_runs" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status_kind TEXT NOT NULL CHECK (status_kind IN ('pending','streaming','succeeded','failed','cancelled')),
  status_payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "session_external_tasks" (
  session_id TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  branch TEXT, scope TEXT NOT NULL DEFAULT 'session'
  CHECK (scope IN ('session', 'branch')), relation TEXT NOT NULL DEFAULT 'closes'
  CHECK (relation IN ('closes', 'part-of')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "open_questions" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  workflow_id TEXT,
  created_by_step_ordinal INTEGER,
  owned_by_step_ordinal INTEGER,
  text TEXT NOT NULL,
  suggested_answers TEXT NOT NULL DEFAULT '[]',
  user_answer TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dismissed')),
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  dismissed_at INTEGER,
  created_by_agent_id TEXT,
  workflow_run_id TEXT,
  turn_ordinal INTEGER,
  recommended_answer TEXT,
  select_mode TEXT CHECK (select_mode IS NULL OR select_mode IN ('one', 'many')), is_blocking INTEGER NOT NULL DEFAULT 0
  CHECK (is_blocking IN (0, 1)), answer_source TEXT
  CHECK (answer_source IS NULL OR answer_source IN ('user', 'agent')), answered_by_agent_id TEXT
  REFERENCES agents(id) ON DELETE SET NULL, answer_delivered_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

CREATE TABLE "file_versions" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('modified', 'deleted')),
  snapshot_source TEXT NOT NULL CHECK (snapshot_source IN ('agent_turn', 'restore')),
  provider_run_id TEXT,
  captured_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_run_id) REFERENCES provider_runs(id) ON DELETE SET NULL
);

CREATE TABLE "goal_attachments" (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  workflow_run_id TEXT,
  rel_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK ((session_id IS NOT NULL) <> (workflow_run_id IS NOT NULL)),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE CASCADE
);

CREATE TABLE "integration_credentials" (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE integration_bindings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (credential_id) REFERENCES integration_credentials(id) ON DELETE RESTRICT
);

CREATE TABLE "workspace_profiles" (
  workspace_id TEXT PRIMARY KEY,
  bio TEXT,
  updated_at INTEGER, roles_json TEXT, about_work TEXT, working_rules TEXT, explain_more_json TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE resolve_imports (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, version)
);

CREATE TABLE resolve_publications (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  branch TEXT NOT NULL,
  local_head TEXT NOT NULL,
  remote_head TEXT,
  commit_shas_json TEXT NOT NULL CHECK (json_valid(commit_shas_json)),
  requires_push INTEGER NOT NULL CHECK (requires_push IN (0, 1)),
  phase TEXT NOT NULL CHECK (phase IN ('previewed', 'confirmed', 'pushing', 'pushed', 'posting', 'finished', 'failed', 'cancelled')),
  pushed_head TEXT,
  confirmed_at INTEGER,
  completed_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
, target_ref TEXT NOT NULL DEFAULT '', candidate_ids_json TEXT NOT NULL DEFAULT '[]', approved_item_ids_json TEXT NOT NULL DEFAULT '[]', mount_id TEXT, mount_revision INTEGER, worktree_path TEXT, holder TEXT, heartbeat_at INTEGER);

CREATE TABLE resolve_publication_threads (
  publication_id TEXT NOT NULL REFERENCES resolve_publications(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  prior_state TEXT NOT NULL,
  reply_body TEXT,
  reply_phase TEXT NOT NULL CHECK (reply_phase IN ('pending', 'sending', 'posted', 'uncertain', 'skipped')),
  reply_id TEXT,
  reply_posted_at INTEGER,
  resolve_phase TEXT NOT NULL CHECK (resolve_phase IN ('pending', 'resolving', 'resolved', 'uncertain', 'skipped')),
  resolved_at INTEGER,
  error TEXT, source_fingerprint TEXT, operation_id TEXT NOT NULL DEFAULT '', reply_attempted_at INTEGER,
  PRIMARY KEY (publication_id, thread_id)
);

CREATE TABLE "session_worktrees" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  worktree_path TEXT,
  branch TEXT NOT NULL,
  parallel_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  project_id TEXT,
  mount_name TEXT,
  repo_slug TEXT,
  last_worktree_path TEXT,
  is_attached INTEGER NOT NULL DEFAULT 1 CHECK (is_attached IN (0, 1)),
  disk_state TEXT NOT NULL DEFAULT 'unchecked' CHECK (disk_state IN ('unchecked', 'present', 'missing', 'removed')),
  base_branch TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL DEFAULT 0, branch_origin TEXT NOT NULL DEFAULT 'unknown'
  CHECK (branch_origin IN ('created', 'adopted', 'unknown')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE "sessions" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  state_kind TEXT NOT NULL CHECK (state_kind IN ('draft', 'starting', 'idle', 'running', 'error', 'ended')),
  last_activity_at INTEGER,
  provider_default TEXT NOT NULL DEFAULT 'anthropic',
  provider_allow_override INTEGER NOT NULL DEFAULT 1,
  default_provider_id TEXT,
  default_branch_prefix TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  permission_mode TEXT NOT NULL DEFAULT 'bypassPermissions',
  auto_run INTEGER NOT NULL DEFAULT 0,
  title_user_edited INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  deleted_at INTEGER,
  verbosity TEXT,
  effort TEXT,
  model_override TEXT,
  provider_override TEXT,
  provider_bindings TEXT,
  provider_enabled TEXT,
  active_project_id TEXT,
  active_mount_id TEXT, context_seen_at INTEGER, last_opened_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (active_mount_id) REFERENCES "session_worktrees"(id) ON DELETE RESTRICT
);

CREATE TABLE mount_pr_links (
  id TEXT PRIMARY KEY,
  mount_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  host TEXT NOT NULL,
  repo_slug TEXT NOT NULL,
  pr_number INTEGER NOT NULL CHECK (pr_number > 0),
  head_branch TEXT NOT NULL,
  base_branch TEXT,
  url TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft', 'open', 'approved', 'queued', 'merged', 'closed')),
  snapshot_json TEXT NOT NULL,
  last_observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, merged_head_sha TEXT, merged_at INTEGER,
  FOREIGN KEY (mount_id) REFERENCES session_worktrees(id) ON DELETE CASCADE,
  UNIQUE (mount_id, provider, host, repo_slug, pr_number)
);

CREATE TABLE mount_operations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  mount_id TEXT,
  request_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('attach', 'unmount', 'switch', 'fork', 'remove', 'restore', 'retain')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'uncertain')),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  input_json TEXT NOT NULL,
  result_json TEXT,
  error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (mount_id) REFERENCES session_worktrees(id) ON DELETE SET NULL,
  UNIQUE (session_id, request_id)
);

CREATE TABLE pr_series (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  work_item_identifier TEXT,
  work_item_url TEXT,
  planned_count INTEGER CHECK (planned_count IS NULL OR planned_count > 0),
  parent_request_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE pr_series_members (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  mount_id TEXT,
  branch TEXT,
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'omitted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (series_id) REFERENCES pr_series(id) ON DELETE CASCADE,
  FOREIGN KEY (mount_id) REFERENCES session_worktrees(id) ON DELETE SET NULL,
  UNIQUE (series_id, ordinal)
);

CREATE TABLE resolve_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  base_sha TEXT NOT NULL,
  candidate_sha TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('building', 'ready', 'integrated', 'stale', 'discarded')),
  integrated_sha TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
, mount_id TEXT, mount_revision INTEGER);

CREATE TABLE resolve_candidate_items (
  candidate_id TEXT NOT NULL REFERENCES resolve_candidates(id) ON DELETE CASCADE,
  queue_item_id TEXT NOT NULL REFERENCES resolve_queue_items(id) ON DELETE CASCADE,
  item_revision INTEGER NOT NULL,
  PRIMARY KEY (candidate_id, queue_item_id)
);

CREATE TABLE resolve_check_runs (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES resolve_candidates(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  test_identity TEXT,
  breadth TEXT NOT NULL CHECK (breadth IN ('scoped', 'full')),
  base_tree TEXT NOT NULL,
  candidate_tree TEXT,
  accepted_set TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('passed', 'failed', 'errored')),
  exit_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  log_ref TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE "resolve_queue_items" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 0),
  reopened_from_item_id TEXT REFERENCES "resolve_queue_items"(id) ON DELETE RESTRICT,
  candidate_revision INTEGER NOT NULL CHECK (candidate_revision >= 0),
  approval_state TEXT NOT NULL CHECK (approval_state IN ('none', 'accepted', 'deferred', 'wont_fix')),
  approved_revision INTEGER,
  approved_reply_hash TEXT,
  deferred_at INTEGER,
  delivered_at INTEGER,
  superseded_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  integrated_sha TEXT,
  UNIQUE (session_id, thread_id, generation)
);

CREATE TABLE session_artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  workflow_run_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'report', 'wireframe')),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  title TEXT NOT NULL,
  source_format TEXT NOT NULL CHECK (source_format IN ('markdown', 'json')),
  source_text TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'superseded', 'discarded')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  source_turn_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, opened_at INTEGER, kept_at INTEGER, kept_until INTEGER,
  UNIQUE (id, kind),
  UNIQUE (agent_id, source_turn_id),
  CHECK (status <> 'consumed' OR kind = 'plan'),
  CHECK (
    (kind IN ('plan', 'report') AND source_format = 'markdown')
    OR (kind = 'wireframe' AND source_format = 'json')
  ),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_id) REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL
);

CREATE TABLE "plan_consumptions" (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL DEFAULT 'plan' CHECK (artifact_kind = 'plan'),
  agent_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL,
  FOREIGN KEY (plan_id, artifact_kind) REFERENCES session_artifacts(id, kind) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE artifact_provenance (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'report', 'wireframe')),
  brief TEXT,
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json) AND json_type(evidence_json) = 'array'),
  omissions_json TEXT NOT NULL CHECK (json_valid(omissions_json) AND json_type(omissions_json) = 'array'),
  design_profile_summary TEXT,
  source_workflow_run_id TEXT REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  executing_workflow_run_id TEXT REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
, has_design_evidence INTEGER NOT NULL DEFAULT 0 CHECK (has_design_evidence IN (0, 1)), phase TEXT NOT NULL DEFAULT 'done' CHECK (phase IN ('gathering', 'producing', 'done', 'failed')), scout_plan_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(scout_plan_json) AND json_type(scout_plan_json) = 'array'), mount_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(mount_ids_json) AND json_type(mount_ids_json) = 'array'), target TEXT, deadline_at INTEGER);

CREATE TABLE agent_turn_spans (
  run_id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_run_id TEXT REFERENCES session_workflows(workflow_run_id) ON DELETE SET NULL,
  step_role TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  effort TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL CHECK (ended_at >= started_at),
  end_reason TEXT NOT NULL CHECK (end_reason IN ('succeeded', 'failed', 'cancelled', 'awaiting_user')),
  cost_usd REAL
, touched_mount_ids TEXT);

CREATE TABLE agent_queued_messages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  override_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE provider_limits (
  provider_id TEXT PRIMARY KEY,
  plan TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'reached')),
  windows TEXT NOT NULL DEFAULT '[]',
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE "retained_worktree_paths" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  project_id TEXT,
  source_session_id TEXT,
  source_mount_id TEXT,
  repo_root TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  branch TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unmount', 'merge_cleanup', 'archive', 'session_delete', 'project_disconnect', 'settings', 'orphan')),
  last_checked_at INTEGER,
  first_seen_at INTEGER NOT NULL,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sized_at INTEGER,
  kept_at INTEGER,
  kept_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((source_session_id IS NULL) = (source_mount_id IS NULL)),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE worktree_roots (
  repo_root TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_scanned_at INTEGER,
  added_by TEXT NOT NULL CHECK (added_by IN ('project', 'mount', 'user'))
);

CREATE TABLE agent_handoffs (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  sender_json TEXT NOT NULL CHECK (json_valid(sender_json)),
  ask TEXT NOT NULL,
  why TEXT,
  done_when TEXT,
  sections_json TEXT NOT NULL CHECK (json_valid(sections_json)),
  sent_system TEXT,
  sent_message TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE security_findings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NULL,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('script', 'workflow-step', 'profile', 'reply-template', 'permission-rule')),
  subject_id TEXT NOT NULL,
  secret_kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  last4 TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  dismissed_at INTEGER NULL,
  resolved_at INTEGER NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE project_sentry_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sentry_org TEXT NOT NULL,
  sentry_project TEXT NOT NULL,
  sentry_project_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'code_mapping')),
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, sentry_org, sentry_project)
);

CREATE TABLE session_decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'replaced', 'withdrawn')),
  replaced_by INTEGER NULL,
  author TEXT NOT NULL CHECK (author IN ('agent', 'summarizer', 'user')),
  agent_id TEXT NULL,
  turn_ordinal INTEGER NULL,
  reason TEXT NULL,
  closed_by TEXT NULL CHECK (closed_by IS NULL OR closed_by IN ('agent', 'summarizer', 'user')),
  closed_by_agent_id TEXT NULL,
  previous_text TEXT NULL,
  reworded_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, why TEXT NULL,
  UNIQUE (session_id, number),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE history_plans (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  mount_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'applied', 'pushed', 'discarded')),
  backup_ref TEXT NULL,
  remote_sha_at_apply TEXT NULL,
  applied_at INTEGER NULL,
  pushed_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE artifact_revisions (
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  title TEXT NOT NULL,
  source_text TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
  author TEXT NOT NULL CHECK (author IN ('agent', 'user', 'import', 'restore')),
  ask TEXT,
  pinned_json TEXT CHECK (pinned_json IS NULL OR json_valid(pinned_json)),
  summary_json TEXT CHECK (summary_json IS NULL OR json_valid(summary_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, revision),
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE
);

CREATE TABLE integration_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  verb TEXT NOT NULL,
  target_json TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'discarded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  decided_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE "resolve_threads" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id TEXT,
  pr_number INTEGER,
  thread_id TEXT NOT NULL,
  origin_kind TEXT NOT NULL CHECK (origin_kind IN ('review_comment', 'issue_comment', 'diff_comment')),
  diff_comment_id TEXT REFERENCES diff_comments(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'working', 'needs_answer', 'fixed', 'answered', 'failed', 'publishing', 'closed')),
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'working', 'asking', 'proposed', 'approved', 'publishing', 'failed', 'parked', 'resolved')),
  state_reason TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active_attempt_id TEXT,
  disposition TEXT CHECK (disposition IN ('fix', 'reply', 'no_change')),
  reply_draft TEXT,
  commit_shas_json TEXT CHECK (commit_shas_json IS NULL OR json_valid(commit_shas_json)),
  fixup_of_sha TEXT,
  replaces_sha TEXT,
  question TEXT,
  reply_posted_at INTEGER,
  reply_id TEXT,
  github_resolved INTEGER CHECK (github_resolved IN (0, 1)),
  closed_at INTEGER,
  closed_source TEXT CHECK (closed_source IN ('goodboy', 'github')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, generation INTEGER NOT NULL DEFAULT 0, reopened_from_thread_id TEXT REFERENCES resolve_threads(id) ON DELETE SET NULL, git_state TEXT CHECK (git_state IS NULL OR git_state IN ('local', 'on_origin', 'fixed_elsewhere', 'folded', 'missing')), verdict_json TEXT CHECK (verdict_json IS NULL OR json_valid(verdict_json)), source_snapshot_json TEXT CHECK (source_snapshot_json IS NULL OR json_valid(source_snapshot_json)), source_kind TEXT NOT NULL DEFAULT 'github' CHECK (source_kind IN ('github', 'gitlab', 'bitbucket', 'local')), provider_thread_id TEXT,
  UNIQUE (session_id, thread_id)
);

CREATE TABLE "resolve_attempts" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  pr_number INTEGER,
  thread_ids_json TEXT NOT NULL CHECK (json_valid(thread_ids_json)),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  effort TEXT,
  instructions TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('queued', 'running', 'waiting', 'finished', 'failed', 'cancelled')),
  mount_id TEXT,
  mount_revision INTEGER,
  worktree_path TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
, batch_id TEXT REFERENCES resolve_batches(id) ON DELETE SET NULL, copy_path TEXT, launch_choice_json TEXT CHECK (launch_choice_json IS NULL OR json_valid(launch_choice_json)), human_instructions TEXT, launch_id TEXT, retry_of_launch_id TEXT, failure_cause TEXT);

CREATE TABLE project_relocations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_root TEXT NOT NULL,
  to_root TEXT NOT NULL,
  moved_at INTEGER NOT NULL,
  undone_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE deleted_branches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT,
  repo_root TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  keep_ref TEXT NOT NULL,
  on_origin INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL,
  restored_at INTEGER
);

CREATE TABLE "session_events" (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'worktree_created',
    'branch_created',
    'branch_switched',
    'branch_deleted',
    'branch_restored',
    'issue_linked',
    'issue_unlinked',
    'pr_created',
    'pr_discovered',
    'pr_ready',
    'pr_approved',
    'pr_merged',
    'pr_closed',
    'workflow_started',
    'workflow_discarded',
    'workflow_restored',
    'workflow_closed',
    'workflow_deleted',
    'decisions_changed',
    'project_materialized',
    'project_materialization_refused',
    'project_materialization_proposed',
    'project_materialization_dismissed',
    'project_detached',
    'external_task_created',
    'rebase_requested',
    'session_archived',
    'session_restored',
    'write_destination_changed',
    'question_dismissed',
    'question_restored',
    'history_rewritten',
    'history_pushed',
    'history_stopped',
    'history_restored'
  )),
  payload_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE workspace_starred_issues (
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  identifier TEXT NOT NULL,
  container TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  state_label TEXT,
  starred_at INTEGER NOT NULL,
  refreshed_at INTEGER,
  PRIMARY KEY (workspace_id, provider, external_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE search_index USING fts5(
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE search_docs (
  id TEXT PRIMARY KEY,
  fts_rowid INTEGER NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN (
    'session', 'message', 'agent', 'plan', 'report', 'wireframe',
    'decision', 'question', 'issue', 'pr', 'branch', 'workflow', 'comment'
  )),
  ref_id TEXT NOT NULL,
  workspace_id TEXT NULL,
  session_id TEXT NULL,
  agent_id TEXT NULL,
  mount_id TEXT NULL,
  project_id TEXT NULL,
  provider TEXT NULL,
  container TEXT NULL,
  status TEXT NULL,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (mount_id) REFERENCES session_worktrees(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE search_index_state (
  id TEXT PRIMARY KEY,
  cursor TEXT NULL,
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE search_excluded_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'codex')),
  model TEXT NOT NULL,
  pinned_at INTEGER NULL,
  archived_at INTEGER NULL,
  last_activity_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, effort TEXT NULL, session_id TEXT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('streaming', 'done', 'failed', 'stopped')),
  reads TEXT NULL,
  error TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, provider TEXT NULL, model TEXT NULL, effort TEXT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE resolve_batches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  thread_ids_json TEXT NOT NULL CHECK (json_valid(thread_ids_json)),
  launch_choice_json TEXT NOT NULL CHECK (json_valid(launch_choice_json)),
  created_at INTEGER NOT NULL
);

CREATE TABLE resolve_session_settings (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  parallel_limit INTEGER NOT NULL DEFAULT 4 CHECK (parallel_limit BETWEEN 1 AND 16),
  updated_at INTEGER NOT NULL
);

CREATE TABLE chat_session_links (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  message_id TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('new', 'add')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE session_context_items (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  topic TEXT,
  source_json TEXT,
  audience_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE chat_message_attachments (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type LIKE 'image/%'),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE artifact_comments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  anchor_json TEXT NOT NULL CHECK (json_valid(anchor_json) AND json_type(anchor_json) = 'object'),
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'addressed', 'open')) DEFAULT 'draft',
  sent_turn_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE
);

CREATE TABLE "telemetry_records" (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'turn' CHECK (kind IN ('turn','summarizer','orchestrator','ask')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL,
  recorded_at INTEGER NOT NULL,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  context_tokens INTEGER,
  FOREIGN KEY (run_id) REFERENCES provider_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE auto_attempts (
  id TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
  state TEXT NOT NULL DEFAULT 'starting' CHECK (state IN ('starting', 'running', 'paused', 'ended')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('completed', 'failed', 'blocked', 'stopped', 'timed_out')),
  run_id TEXT,
  question_id TEXT,
  baseline_json TEXT CHECK (baseline_json IS NULL OR json_valid(baseline_json)),
  result_snapshot_json TEXT CHECK (result_snapshot_json IS NULL OR json_valid(result_snapshot_json)),
  write_set_json TEXT CHECK (write_set_json IS NULL OR json_valid(write_set_json)),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  end_reason TEXT,
  UNIQUE (delegation_id, ordinal),
  CHECK ((state = 'ended') = (outcome IS NOT NULL)),
  FOREIGN KEY (delegation_id) REFERENCES auto_delegations(id) ON DELETE CASCADE,
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE TABLE auto_reservations (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('attempt', 'auto_turn', 'aux')),
  owner_id TEXT NOT NULL,
  reserved_usd REAL NOT NULL CHECK (reserved_usd >= 0),
  state TEXT NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'reconciled', 'released')),
  actual_usd REAL CHECK (actual_usd IS NULL OR actual_usd >= 0),
  cost_known INTEGER CHECK (cost_known IS NULL OR cost_known IN (0, 1)),
  released_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (tree_id, owner_kind, owner_id),
  CHECK ((state = 'reconciled') = (actual_usd IS NOT NULL)),
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE TABLE auto_outbox (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('results', 'question', 'user', 'refusal')),
  join_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'claimed', 'accepted', 'dropped')),
  claimed_by TEXT,
  claim_expires_at INTEGER,
  accepted_run_id TEXT,
  dropped_reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (tree_id, join_key),
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE TABLE auto_artifacts (
  artifact_id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'report', 'wireframe')),
  owner_agent_id TEXT NOT NULL,
  owner_delegation_id TEXT NOT NULL,
  owner_role TEXT NOT NULL CHECK (owner_role IN ('scout', 'planner', 'investigator', 'reviewer', 'implementer', 'tester', 'docs')),
  approval_state TEXT NOT NULL DEFAULT 'needs_approval' CHECK (approval_state IN ('needs_approval', 'approved', 'revising')),
  approved_revision INTEGER CHECK (approved_revision IS NULL OR approved_revision >= 1),
  open_revise_delegation_id TEXT,
  rev INTEGER NOT NULL DEFAULT 0 CHECK (rev >= 0),
  created_at INTEGER NOT NULL,
  CHECK (approval_state <> 'approved' OR approved_revision IS NOT NULL),
  CHECK (approval_state <> 'revising' OR open_revise_delegation_id IS NOT NULL),
  FOREIGN KEY (artifact_id) REFERENCES session_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE
);

CREATE TABLE auto_artifact_versions (
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  delegation_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  base_revision INTEGER CHECK (base_revision IS NULL OR base_revision >= 1),
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (artifact_id, revision),
  UNIQUE (artifact_id, attempt_id),
  FOREIGN KEY (artifact_id) REFERENCES auto_artifacts(artifact_id) ON DELETE CASCADE
);

CREATE TABLE "auto_trees" (
  id TEXT PRIMARY KEY,
  root_agent_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  primary_mount_id TEXT,
  generation INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  phase TEXT NOT NULL DEFAULT 'answering' CHECK (
    phase IN ('answering', 'deciding', 'delegating', 'waiting', 'merging', 'done', 'finished', 'blocked', 'stopping', 'stopped')
  ),
  phase_rev INTEGER NOT NULL DEFAULT 0 CHECK (phase_rev >= 0),
  blocked_reason TEXT,
  active_run_id TEXT,
  active_delivery_id TEXT,
  is_yield_requested INTEGER NOT NULL DEFAULT 0 CHECK (is_yield_requested IN (0, 1)),
  stop_state TEXT NOT NULL DEFAULT 'none' CHECK (stop_state IN ('none', 'requested', 'confirming', 'confirmed')),
  cap_usd REAL CHECK (cap_usd IS NULL OR cap_usd >= 0),
  turns_used INTEGER NOT NULL DEFAULT 0 CHECK (turns_used >= 0),
  delegations_used INTEGER NOT NULL DEFAULT 0 CHECK (delegations_used >= 0),
  attempts_used INTEGER NOT NULL DEFAULT 0 CHECK (attempts_used >= 0),
  refusals_used INTEGER NOT NULL DEFAULT 0 CHECK (refusals_used >= 0),
  last_refusal_key TEXT,
  turn_delegate_calls INTEGER NOT NULL DEFAULT 0 CHECK (turn_delegate_calls >= 0),
  no_progress_streak INTEGER NOT NULL DEFAULT 0 CHECK (no_progress_streak >= 0),
  question_cycles INTEGER NOT NULL DEFAULT 0 CHECK (question_cycles >= 0),
  grants INTEGER NOT NULL DEFAULT 0 CHECK (grants >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  hard_deadline_at INTEGER NOT NULL,
  scheduler_owner TEXT,
  owner_lease_expires_at INTEGER,
  FOREIGN KEY (root_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (primary_mount_id) REFERENCES session_worktrees(id) ON DELETE SET NULL
);

CREATE TABLE "auto_delegations" (
  id TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK (generation >= 1),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot >= 0),
  child_agent_id TEXT NOT NULL,
  first_attempt_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('scout', 'planner', 'investigator', 'reviewer', 'implementer', 'tester', 'docs', 'scribe', 'ci-fixer', 'rewriter')),
  request_json TEXT NOT NULL CHECK (json_valid(request_json) AND json_type(request_json) = 'object'),
  target_json TEXT NOT NULL CHECK (json_valid(target_json) AND json_type(target_json) = 'object'),
  routing_json TEXT NOT NULL CHECK (json_valid(routing_json) AND json_type(routing_json) = 'object'),
  state TEXT NOT NULL DEFAULT 'accepted' CHECK (
    state IN ('accepted', 'awaiting_confirm', 'starting', 'running', 'paused', 'settled')
  ),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('completed', 'failed', 'blocked', 'stopped', 'timed_out')),
  reason TEXT,
  retry_of TEXT,
  revise_of TEXT,
  base_revision INTEGER CHECK (base_revision IS NULL OR base_revision >= 1),
  adopted INTEGER NOT NULL DEFAULT 0 CHECK (adopted IN (0, 1)),
  is_stopping INTEGER NOT NULL DEFAULT 0 CHECK (is_stopping IN (0, 1)),
  question_cycles INTEGER NOT NULL DEFAULT 0 CHECK (question_cycles >= 0),
  deadline_at INTEGER NOT NULL,
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at INTEGER NOT NULL,
  settled_at INTEGER,
  UNIQUE (tree_id, request_id, slot),
  CHECK ((state = 'settled') = (outcome IS NOT NULL)),
  CHECK (state <> 'settled' OR settled_at IS NOT NULL),
  FOREIGN KEY (tree_id) REFERENCES auto_trees(id) ON DELETE CASCADE,
  FOREIGN KEY (retry_of) REFERENCES auto_delegations(id) ON DELETE SET NULL
);

CREATE TABLE workspace_values (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE project_values (
  project_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, key),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE turn_file_sets (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  mount_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  own_json TEXT NOT NULL,
  from_base_json TEXT NOT NULL,
  is_partial INTEGER NOT NULL DEFAULT 0 CHECK (is_partial IN (0, 1)),
  recorded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (run_id, mount_id)
);

CREATE INDEX idx_permission_audit_retry_created ON permission_audit_retry(created_at);

CREATE INDEX idx_turn_events_agent_created ON turn_events(agent_id, created_at);

CREATE INDEX idx_turn_events_session_created ON turn_events(session_id, created_at);

CREATE INDEX idx_context_slot_history_session_key
  ON context_slot_history(session_id, key, created_at DESC);

CREATE INDEX idx_provider_credentials_provider_id ON provider_credentials(provider_id);

CREATE INDEX idx_project_scripts_project ON project_scripts(project_id, sort_order);

CREATE INDEX idx_projects_active ON projects(disconnected_at);

CREATE INDEX idx_projects_last_accessed_at ON projects(last_accessed_at);

CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);

CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);

CREATE INDEX idx_messages_agent_created ON messages(agent_id, created_at);

CREATE INDEX idx_diff_comments_session_status ON diff_comments(session_id, status);

CREATE INDEX idx_diff_comments_session_file_line
  ON diff_comments(session_id, file_path, line_side, line_number);

CREATE INDEX idx_diff_comments_consumed_by ON diff_comments(consumed_by_agent_id);

CREATE INDEX idx_steps_workflow_id ON steps(workflow_id);

CREATE INDEX idx_step_library_workspace ON step_library(workspace_id);

CREATE INDEX idx_session_workflows_session_id ON session_workflows(session_id, ordinal);

CREATE INDEX idx_session_workflows_workflow_id ON session_workflows(workflow_id);

CREATE INDEX idx_session_workflows_chain_after_run_id
  ON session_workflows(chain_after_run_id)
  WHERE chain_after_run_id IS NOT NULL;

CREATE INDEX idx_agents_active ON agents(session_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_agents_step_id ON agents(step_id) WHERE step_id IS NOT NULL;

CREATE INDEX idx_agents_unread ON agents(session_id, last_finished_at DESC);

CREATE INDEX idx_agents_workflow_run_id
  ON agents(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX idx_budget_rules_provider ON budget_rules(provider);

CREATE INDEX idx_budget_alerts_active
  ON budget_alerts(created_at DESC)
  WHERE dismissed_at IS NULL;

CREATE INDEX idx_budget_alerts_provider ON budget_alerts(provider);

CREATE INDEX idx_budget_alerts_session_id ON budget_alerts(session_id);

CREATE INDEX idx_notifications_session_id
  ON notifications(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX idx_notifications_unread
  ON notifications(ts DESC)
  WHERE read = 0;

CREATE INDEX idx_notifications_workspace_id
  ON notifications(workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX idx_nudge_kind_created_at ON nudge_events(kind, created_at);

CREATE INDEX idx_nudge_session_id ON nudge_events(session_id);

CREATE INDEX idx_permission_rules_project_id ON permission_rules(project_id);

CREATE INDEX idx_permission_rules_scope ON permission_rules(scope);

CREATE INDEX idx_permission_rules_session_id ON permission_rules(session_id);

CREATE INDEX idx_permission_rules_workspace_id ON permission_rules(workspace_id);

CREATE INDEX idx_permission_audit_rule_id ON permission_audit_log(rule_id);

CREATE INDEX idx_permission_audit_run_id ON permission_audit_log(run_id);

CREATE INDEX idx_pr_review_drafts_session ON pr_review_drafts(session_id);

CREATE INDEX idx_provider_runs_session_id ON provider_runs(session_id);

CREATE INDEX idx_session_external_tasks_provider_external
  ON session_external_tasks(provider, external_id);

CREATE INDEX idx_open_questions_created_by_agent ON open_questions(created_by_agent_id);

CREATE INDEX idx_open_questions_run_id
  ON open_questions(workflow_run_id, owned_by_step_ordinal);

CREATE INDEX idx_open_questions_session ON open_questions(session_id, status);

CREATE UNIQUE INDEX idx_open_questions_session_text_open
  ON open_questions(session_id, text)
  WHERE status = 'open';

CREATE INDEX idx_open_questions_workflow
  ON open_questions(workflow_id, owned_by_step_ordinal);

CREATE INDEX idx_file_versions_session_path_captured
  ON file_versions(session_id, relative_path, captured_at DESC);

CREATE INDEX idx_file_versions_provider_run_id
  ON file_versions(provider_run_id)
  WHERE provider_run_id IS NOT NULL;

CREATE INDEX idx_goal_attachments_session_id
  ON goal_attachments(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX idx_goal_attachments_workflow_run_id
  ON goal_attachments(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX idx_permission_audit_session_requested_at
  ON permission_audit_log(session_id, requested_at);

CREATE INDEX idx_notifications_ts ON notifications(ts);

CREATE INDEX idx_diff_comments_session_created_at ON diff_comments(session_id, created_at);

CREATE INDEX idx_skills_workspace_created_at ON skills(workspace_id, created_at);

CREATE INDEX idx_integration_credentials_provider ON integration_credentials(provider);

CREATE UNIQUE INDEX idx_integration_bindings_scope
  ON integration_bindings(workspace_id, COALESCE(project_id, ''), provider);

CREATE INDEX idx_integration_bindings_credential_id ON integration_bindings(credential_id);

CREATE INDEX idx_resolve_publications_target ON resolve_publications(repo, pr_number, phase);

CREATE INDEX idx_resolve_publications_session ON resolve_publications(session_id, created_at);

CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id);

CREATE INDEX idx_sessions_active
  ON sessions(workspace_id, updated_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX idx_sessions_archived
  ON sessions(workspace_id, archived_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NOT NULL;

CREATE INDEX idx_sessions_active_mount_id ON sessions(active_mount_id);

CREATE UNIQUE INDEX idx_session_worktrees_path ON session_worktrees(worktree_path);

CREATE INDEX idx_session_worktrees_repo_slug_branch ON session_worktrees(repo_slug, branch);

CREATE INDEX idx_session_worktrees_project_id ON session_worktrees(project_id);

CREATE INDEX idx_session_worktrees_session_attached
  ON session_worktrees(session_id, is_attached, parallel_index, created_at, id);

CREATE INDEX idx_mount_pr_links_request
  ON mount_pr_links(provider, host, repo_slug, pr_number);

CREATE INDEX idx_mount_pr_links_head_branch ON mount_pr_links(head_branch);

CREATE INDEX idx_mount_operations_mount_id ON mount_operations(mount_id);

CREATE INDEX idx_mount_operations_status ON mount_operations(status, updated_at);

CREATE INDEX idx_pr_series_project_id ON pr_series(project_id);

CREATE UNIQUE INDEX idx_pr_series_name ON pr_series(session_id, project_id, name);

CREATE INDEX idx_pr_series_members_series_id ON pr_series_members(series_id, ordinal);

CREATE INDEX idx_pr_series_members_mount_id ON pr_series_members(mount_id);

CREATE UNIQUE INDEX idx_pr_series_members_branch
  ON pr_series_members(series_id, mount_id, branch)
  WHERE mount_id IS NOT NULL AND branch IS NOT NULL;

CREATE INDEX idx_resolve_candidates_session ON resolve_candidates(session_id, created_at);

CREATE INDEX idx_resolve_candidate_items_item ON resolve_candidate_items(queue_item_id);

CREATE INDEX idx_resolve_check_runs_session ON resolve_check_runs(session_id, created_at);

CREATE INDEX idx_resolve_check_runs_candidate ON resolve_check_runs(candidate_id, created_at);

CREATE INDEX idx_resolve_queue_items_session ON resolve_queue_items(session_id, created_at);

CREATE INDEX idx_resolve_queue_items_thread ON resolve_queue_items(thread_id);

CREATE INDEX idx_resolve_queue_items_reopened_from ON resolve_queue_items(reopened_from_item_id);

CREATE UNIQUE INDEX idx_resolve_queue_items_live_thread ON resolve_queue_items(session_id, thread_id) WHERE superseded_at IS NULL;

CREATE INDEX idx_resolve_candidates_mount ON resolve_candidates(mount_id);

CREATE INDEX idx_resolve_publications_mount ON resolve_publications(mount_id);

CREATE INDEX idx_session_artifacts_session
  ON session_artifacts(session_id, created_at ASC);

CREATE INDEX idx_session_artifacts_run_id
  ON session_artifacts(workflow_run_id, created_at ASC)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX idx_plan_consumptions_plan
  ON plan_consumptions(plan_id, consumed_at DESC);

CREATE INDEX idx_plan_consumptions_agent ON plan_consumptions(agent_id);

CREATE INDEX idx_artifact_provenance_session
  ON artifact_provenance(session_id, created_at ASC);

CREATE INDEX idx_artifact_provenance_source_run
  ON artifact_provenance(source_workflow_run_id)
  WHERE source_workflow_run_id IS NOT NULL;

CREATE INDEX idx_artifact_provenance_executing_run
  ON artifact_provenance(executing_workflow_run_id)
  WHERE executing_workflow_run_id IS NOT NULL;

CREATE UNIQUE INDEX idx_workflows_workspace_name_live
  ON workflows(workspace_id, name)
  WHERE deleted_at IS NULL AND is_preset = 1;

CREATE INDEX idx_provider_runs_status_created
  ON provider_runs(status_kind, created_at);

CREATE INDEX idx_agent_turn_spans_agent ON agent_turn_spans(agent_id, started_at);

CREATE INDEX idx_agent_turn_spans_session ON agent_turn_spans(session_id);

CREATE INDEX idx_agent_turn_spans_workflow_run ON agent_turn_spans(workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX idx_agent_turn_spans_estimate ON agent_turn_spans(workspace_id, step_role, provider, model, effort, ended_at);

CREATE INDEX idx_agent_queued_messages_agent
  ON agent_queued_messages(agent_id, position);

CREATE INDEX idx_retained_worktree_paths_workspace_id ON retained_worktree_paths(workspace_id);

CREATE INDEX idx_retained_worktree_paths_project_id ON retained_worktree_paths(project_id);

CREATE UNIQUE INDEX idx_retained_worktree_paths_path ON retained_worktree_paths(worktree_path);

CREATE INDEX idx_retained_worktree_paths_source
  ON retained_worktree_paths(source_session_id, source_mount_id);

CREATE INDEX idx_retained_worktree_paths_repo_root ON retained_worktree_paths(repo_root);

CREATE UNIQUE INDEX idx_security_findings_identity ON security_findings (workspace_id, COALESCE(project_id, ''), subject_kind, subject_id, fingerprint);

CREATE INDEX idx_security_findings_dismissed_resolved ON security_findings (dismissed_at, resolved_at);

CREATE INDEX idx_project_sentry_links_workspace
  ON project_sentry_links (workspace_id);

CREATE INDEX idx_session_decisions_session ON session_decisions (session_id, number);

CREATE UNIQUE INDEX idx_history_plans_one_draft ON history_plans (mount_id) WHERE state = 'draft';

CREATE INDEX idx_history_plans_session ON history_plans (session_id);

CREATE INDEX idx_history_plans_branch ON history_plans (mount_id, branch, state);

CREATE INDEX idx_integration_drafts_workspace_id
  ON integration_drafts(workspace_id);

CREATE INDEX idx_integration_drafts_session_status
  ON integration_drafts(session_id, status, created_at);

CREATE INDEX idx_resolve_threads_session_state ON resolve_threads(session_id, state);

CREATE INDEX idx_resolve_threads_attempt ON resolve_threads(active_attempt_id);

CREATE INDEX idx_resolve_threads_diff_comment ON resolve_threads(diff_comment_id);

CREATE INDEX idx_resolve_attempts_session ON resolve_attempts(session_id, created_at);

CREATE INDEX idx_resolve_attempts_agent ON resolve_attempts(agent_id);

CREATE INDEX idx_resolve_attempts_mount ON resolve_attempts(mount_id);

CREATE INDEX idx_project_relocations_project_id ON project_relocations(project_id);

CREATE INDEX idx_project_relocations_moved_at ON project_relocations(moved_at);

CREATE INDEX idx_deleted_branches_project ON deleted_branches(project_id, deleted_at);

CREATE INDEX idx_session_events_session_id ON session_events(session_id, created_at);

CREATE INDEX idx_search_docs_kind ON search_docs(kind);

CREATE INDEX idx_search_docs_workspace ON search_docs(workspace_id);

CREATE INDEX idx_search_docs_session ON search_docs(session_id);

CREATE INDEX idx_search_docs_agent ON search_docs(agent_id);

CREATE INDEX idx_search_docs_mount ON search_docs(mount_id);

CREATE INDEX idx_search_docs_project ON search_docs(project_id);

CREATE INDEX idx_search_docs_occurred ON search_docs(occurred_at);

CREATE INDEX idx_chats_workspace_activity ON chats (workspace_id, archived_at, last_activity_at);

CREATE INDEX idx_chat_messages_chat_created ON chat_messages (chat_id, created_at);

CREATE INDEX idx_resolve_batches_session ON resolve_batches(session_id, created_at);

CREATE INDEX idx_resolve_attempts_batch ON resolve_attempts(batch_id);

CREATE INDEX idx_chat_session_links_chat ON chat_session_links (chat_id, created_at);

CREATE INDEX idx_chat_session_links_session ON chat_session_links (session_id);

CREATE INDEX idx_deleted_branches_workspace_id ON deleted_branches (workspace_id);

CREATE INDEX idx_integration_bindings_project_id ON integration_bindings (project_id);

CREATE INDEX idx_open_questions_answered_by_agent_id ON open_questions (answered_by_agent_id);

CREATE INDEX idx_resolve_threads_reopened_from_thread_id ON resolve_threads (reopened_from_thread_id);

CREATE INDEX idx_security_findings_project_id ON security_findings (project_id);

CREATE INDEX idx_steps_library_step_id ON steps (library_step_id);

CREATE UNIQUE INDEX idx_session_external_tasks_identity
  ON session_external_tasks(
    session_id,
    provider,
    external_id,
    COALESCE(project_id, ''),
    COALESCE(CASE scope WHEN 'branch' THEN branch END, '')
  );

CREATE INDEX idx_session_context_items_session
  ON session_context_items(session_id, created_at);

CREATE INDEX idx_session_context_items_workspace
  ON session_context_items(workspace_id, kind, created_at);

CREATE UNIQUE INDEX idx_chat_message_attachments_message
  ON chat_message_attachments (message_id, position);

CREATE INDEX idx_chat_message_attachments_chat
  ON chat_message_attachments (chat_id, created_at);

CREATE INDEX idx_resolve_attempts_launch ON resolve_attempts(launch_id);

CREATE INDEX idx_diff_comments_target ON diff_comments(session_id, project_id, branch);

CREATE INDEX idx_artifact_comments_artifact ON artifact_comments(artifact_id, status);

CREATE INDEX idx_artifact_comments_session ON artifact_comments(session_id);

CREATE INDEX idx_telemetry_run_id ON telemetry_records(run_id);

CREATE INDEX idx_telemetry_session_kind ON telemetry_records(session_id, kind);

CREATE INDEX idx_telemetry_recorded_at ON telemetry_records(recorded_at);

CREATE INDEX idx_telemetry_provider ON telemetry_records(provider);

CREATE INDEX idx_chats_session_activity ON chats (session_id, last_activity_at);

CREATE INDEX idx_agents_auto_roots ON agents(session_id, ordinal) WHERE kind = 'auto' AND parent_agent_id IS NULL AND deleted_at IS NULL;

CREATE INDEX idx_auto_attempts_tree ON auto_attempts(tree_id, state);

CREATE INDEX idx_auto_attempts_run ON auto_attempts(run_id) WHERE run_id IS NOT NULL;

CREATE INDEX idx_auto_reservations_tree ON auto_reservations(tree_id, state);

CREATE INDEX idx_auto_outbox_tree ON auto_outbox(tree_id, state, created_at);

CREATE INDEX idx_auto_artifacts_tree ON auto_artifacts(tree_id, created_at);

CREATE INDEX idx_auto_artifacts_owner ON auto_artifacts(owner_agent_id);

CREATE INDEX idx_agents_mount_id ON agents(mount_id) WHERE mount_id IS NOT NULL;

CREATE INDEX idx_auto_trees_session ON auto_trees(session_id);

CREATE INDEX idx_auto_trees_live ON auto_trees(phase) WHERE phase NOT IN ('done', 'finished', 'stopped');

CREATE INDEX idx_auto_delegations_tree ON auto_delegations(tree_id, state);

CREATE INDEX idx_auto_delegations_batch ON auto_delegations(tree_id, batch_id);

CREATE UNIQUE INDEX idx_auto_delegations_open_child
  ON auto_delegations(child_agent_id) WHERE state <> 'settled';

CREATE INDEX idx_auto_delegations_child ON auto_delegations(child_agent_id);

CREATE INDEX idx_turn_file_sets_session ON turn_file_sets(session_id, recorded_at);

CREATE VIEW live_agents AS SELECT * FROM agents WHERE deleted_at IS NULL;

CREATE TRIGGER search_docs_delete AFTER DELETE ON search_docs BEGIN
  DELETE FROM search_index WHERE rowid = OLD.fts_rowid;
END;

CREATE TRIGGER search_session_insert AFTER INSERT ON sessions BEGIN
  DELETE FROM search_docs WHERE id = 'session:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'session:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'session', NEW.id, NEW.workspace_id, NEW.id,
    NULL, NULL, NULL,
    NULL, NULL, NULL,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.goal, '' FROM search_docs WHERE id = 'session:' || NEW.id;
END;

CREATE TRIGGER search_session_update AFTER UPDATE OF goal, workspace_id ON sessions BEGIN
  DELETE FROM search_docs WHERE id IN ('session:' || OLD.id, 'session:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'session:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'session', NEW.id, NEW.workspace_id, NEW.id,
    NULL, NULL, NULL,
    NULL, NULL, NULL,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.goal, '' FROM search_docs WHERE id = 'session:' || NEW.id;
END;

CREATE TRIGGER search_session_delete AFTER DELETE ON sessions BEGIN
  DELETE FROM search_docs WHERE id = 'session:' || OLD.id;
END;

CREATE TRIGGER search_message_insert AFTER INSERT ON messages BEGIN
  DELETE FROM search_docs WHERE id = 'message:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'message:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'message', NEW.id, NULL, NEW.session_id,
    NEW.agent_id, NULL, NULL,
    NULL, NULL, NEW.role,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE NEW.role IN ('user', 'assistant');
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, '', NEW.content FROM search_docs WHERE id = 'message:' || NEW.id;
END;

CREATE TRIGGER search_message_update AFTER UPDATE OF content, role ON messages BEGIN
  DELETE FROM search_docs WHERE id IN ('message:' || OLD.id, 'message:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'message:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'message', NEW.id, NULL, NEW.session_id,
    NEW.agent_id, NULL, NULL,
    NULL, NULL, NEW.role,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE NEW.role IN ('user', 'assistant');
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, '', NEW.content FROM search_docs WHERE id = 'message:' || NEW.id;
END;

CREATE TRIGGER search_message_delete AFTER DELETE ON messages BEGIN
  DELETE FROM search_docs WHERE id = 'message:' || OLD.id;
END;

CREATE TRIGGER search_agent_insert AFTER INSERT ON agents BEGIN
  DELETE FROM search_docs WHERE id = 'agent:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'agent:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'agent', NEW.id, NULL, NEW.session_id,
    NEW.id, NULL, NULL,
    NULL, NULL, NULL,
    COALESCE(NEW.started_at, NEW.last_finished_at, CAST(unixepoch('subsec') * 1000 AS INTEGER)), CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.name, COALESCE(NEW.output_summary, '') FROM search_docs WHERE id = 'agent:' || NEW.id;
END;

CREATE TRIGGER search_agent_update AFTER UPDATE OF name, output_summary ON agents BEGIN
  DELETE FROM search_docs WHERE id IN ('agent:' || OLD.id, 'agent:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'agent:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'agent', NEW.id, NULL, NEW.session_id,
    NEW.id, NULL, NULL,
    NULL, NULL, NULL,
    COALESCE(NEW.started_at, NEW.last_finished_at, CAST(unixepoch('subsec') * 1000 AS INTEGER)), CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.name, COALESCE(NEW.output_summary, '') FROM search_docs WHERE id = 'agent:' || NEW.id;
END;

CREATE TRIGGER search_agent_delete AFTER DELETE ON agents BEGIN
  DELETE FROM search_docs WHERE id = 'agent:' || OLD.id;
END;

CREATE TRIGGER search_artifact_insert AFTER INSERT ON session_artifacts BEGIN
  DELETE FROM search_docs WHERE id = 'artifact:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'artifact:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    NEW.kind, NEW.id, NULL, NEW.session_id,
    NEW.agent_id, NULL, NULL,
    NULL, NULL, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.title, CASE WHEN NEW.source_format = 'markdown' THEN NEW.source_text ELSE '' END FROM search_docs WHERE id = 'artifact:' || NEW.id;
END;

CREATE TRIGGER search_artifact_update AFTER UPDATE OF title, source_text, status ON session_artifacts BEGIN
  DELETE FROM search_docs WHERE id IN ('artifact:' || OLD.id, 'artifact:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'artifact:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    NEW.kind, NEW.id, NULL, NEW.session_id,
    NEW.agent_id, NULL, NULL,
    NULL, NULL, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.title, CASE WHEN NEW.source_format = 'markdown' THEN NEW.source_text ELSE '' END FROM search_docs WHERE id = 'artifact:' || NEW.id;
END;

CREATE TRIGGER search_artifact_delete AFTER DELETE ON session_artifacts BEGIN
  DELETE FROM search_docs WHERE id = 'artifact:' || OLD.id;
END;

CREATE TRIGGER search_decision_insert AFTER INSERT ON session_decisions BEGIN
  DELETE FROM search_docs WHERE id = 'decision:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'decision:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'decision', NEW.id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NULL, NULL, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.text, COALESCE(NEW.why, '') FROM search_docs WHERE id = 'decision:' || NEW.id;
END;

CREATE TRIGGER search_decision_update AFTER UPDATE OF text, why, status ON session_decisions BEGIN
  DELETE FROM search_docs WHERE id IN ('decision:' || OLD.id, 'decision:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'decision:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'decision', NEW.id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NULL, NULL, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.text, COALESCE(NEW.why, '') FROM search_docs WHERE id = 'decision:' || NEW.id;
END;

CREATE TRIGGER search_decision_delete AFTER DELETE ON session_decisions BEGIN
  DELETE FROM search_docs WHERE id = 'decision:' || OLD.id;
END;

CREATE TRIGGER search_question_insert AFTER INSERT ON open_questions BEGIN
  DELETE FROM search_docs WHERE id = 'question:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'question:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'question', NEW.id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NULL, NULL, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.text, COALESCE(NEW.user_answer, '') FROM search_docs WHERE id = 'question:' || NEW.id;
END;

CREATE TRIGGER search_question_update AFTER UPDATE OF text, user_answer, status ON open_questions BEGIN
  DELETE FROM search_docs WHERE id IN ('question:' || OLD.id, 'question:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'question:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'question', NEW.id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NULL, NULL, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.text, COALESCE(NEW.user_answer, '') FROM search_docs WHERE id = 'question:' || NEW.id;
END;

CREATE TRIGGER search_question_delete AFTER DELETE ON open_questions BEGIN
  DELETE FROM search_docs WHERE id = 'question:' || OLD.id;
END;

CREATE TRIGGER search_linked_issue_insert AFTER INSERT ON session_external_tasks BEGIN
  DELETE FROM search_docs WHERE id = 'task:' || NEW.session_id || ':' || NEW.provider || ':' || NEW.external_id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'task:' || NEW.session_id || ':' || NEW.provider || ':' || NEW.external_id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'issue', NEW.external_id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NEW.provider, NEW.identifier, NULL,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.identifier || ' ' || NEW.title, '' FROM search_docs WHERE id = 'task:' || NEW.session_id || ':' || NEW.provider || ':' || NEW.external_id;
END;

CREATE TRIGGER search_linked_issue_update AFTER UPDATE OF session_id, provider, external_id, identifier, title ON session_external_tasks BEGIN
  DELETE FROM search_docs WHERE id IN ('task:' || OLD.session_id || ':' || OLD.provider || ':' || OLD.external_id, 'task:' || NEW.session_id || ':' || NEW.provider || ':' || NEW.external_id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'task:' || NEW.session_id || ':' || NEW.provider || ':' || NEW.external_id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'issue', NEW.external_id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NEW.provider, NEW.identifier, NULL,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.identifier || ' ' || NEW.title, '' FROM search_docs WHERE id = 'task:' || NEW.session_id || ':' || NEW.provider || ':' || NEW.external_id;
END;

CREATE TRIGGER search_starred_issue_insert AFTER INSERT ON workspace_starred_issues BEGIN
  DELETE FROM search_docs WHERE id = 'starred:' || NEW.workspace_id || ':' || NEW.provider || ':' || NEW.external_id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'starred:' || NEW.workspace_id || ':' || NEW.provider || ':' || NEW.external_id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'issue', NEW.external_id, NEW.workspace_id, NULL,
    NULL, NULL, NULL,
    NEW.provider, NEW.identifier, NEW.state,
    NEW.starred_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.identifier || ' ' || NEW.title, COALESCE(NEW.container, '') FROM search_docs WHERE id = 'starred:' || NEW.workspace_id || ':' || NEW.provider || ':' || NEW.external_id;
END;

CREATE TRIGGER search_starred_issue_update AFTER UPDATE OF identifier, title, state, container ON workspace_starred_issues BEGIN
  DELETE FROM search_docs WHERE id IN ('starred:' || OLD.workspace_id || ':' || OLD.provider || ':' || OLD.external_id, 'starred:' || NEW.workspace_id || ':' || NEW.provider || ':' || NEW.external_id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'starred:' || NEW.workspace_id || ':' || NEW.provider || ':' || NEW.external_id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'issue', NEW.external_id, NEW.workspace_id, NULL,
    NULL, NULL, NULL,
    NEW.provider, NEW.identifier, NEW.state,
    NEW.starred_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.identifier || ' ' || NEW.title, COALESCE(NEW.container, '') FROM search_docs WHERE id = 'starred:' || NEW.workspace_id || ':' || NEW.provider || ':' || NEW.external_id;
END;

CREATE TRIGGER search_starred_issue_delete AFTER DELETE ON workspace_starred_issues BEGIN
  DELETE FROM search_docs WHERE id = 'starred:' || OLD.workspace_id || ':' || OLD.provider || ':' || OLD.external_id;
END;

CREATE TRIGGER search_github_pr_insert AFTER INSERT ON github_pr_cache BEGIN
  DELETE FROM search_docs WHERE id = 'ghpr:' || NEW.repo_slug || ':' || NEW.branch;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'ghpr:' || NEW.repo_slug || ':' || NEW.branch, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'pr', NEW.branch, NULL, NULL,
    NULL, NULL, NULL,
    'github', NEW.repo_slug, CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.state') END,
    NEW.fetched_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.number') END IS NOT NULL;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, '#' || CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.number') END || ' ' || COALESCE(CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.title') END, ''), NEW.branch || ' ' || NEW.repo_slug FROM search_docs WHERE id = 'ghpr:' || NEW.repo_slug || ':' || NEW.branch;
END;

CREATE TRIGGER search_github_pr_update AFTER UPDATE OF pr_json ON github_pr_cache BEGIN
  DELETE FROM search_docs WHERE id IN ('ghpr:' || OLD.repo_slug || ':' || OLD.branch, 'ghpr:' || NEW.repo_slug || ':' || NEW.branch);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'ghpr:' || NEW.repo_slug || ':' || NEW.branch, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'pr', NEW.branch, NULL, NULL,
    NULL, NULL, NULL,
    'github', NEW.repo_slug, CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.state') END,
    NEW.fetched_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.number') END IS NOT NULL;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, '#' || CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.number') END || ' ' || COALESCE(CASE WHEN json_valid(NEW.pr_json) THEN json_extract(NEW.pr_json, '$.title') END, ''), NEW.branch || ' ' || NEW.repo_slug FROM search_docs WHERE id = 'ghpr:' || NEW.repo_slug || ':' || NEW.branch;
END;

CREATE TRIGGER search_github_pr_delete AFTER DELETE ON github_pr_cache BEGIN
  DELETE FROM search_docs WHERE id = 'ghpr:' || OLD.repo_slug || ':' || OLD.branch;
END;

CREATE TRIGGER search_mount_pr_insert AFTER INSERT ON mount_pr_links BEGIN
  DELETE FROM search_docs WHERE id = 'mountpr:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'mountpr:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'pr', NEW.id, NULL, NULL,
    NULL, NEW.mount_id, NULL,
    NEW.provider, NEW.repo_slug, NEW.state,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, '#' || NEW.pr_number || ' ' || COALESCE(CASE WHEN json_valid(NEW.snapshot_json) THEN json_extract(NEW.snapshot_json, '$.title') END, ''), NEW.head_branch || ' ' || NEW.repo_slug FROM search_docs WHERE id = 'mountpr:' || NEW.id;
END;

CREATE TRIGGER search_mount_pr_update AFTER UPDATE OF pr_number, head_branch, state, snapshot_json ON mount_pr_links BEGIN
  DELETE FROM search_docs WHERE id IN ('mountpr:' || OLD.id, 'mountpr:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'mountpr:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'pr', NEW.id, NULL, NULL,
    NULL, NEW.mount_id, NULL,
    NEW.provider, NEW.repo_slug, NEW.state,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, '#' || NEW.pr_number || ' ' || COALESCE(CASE WHEN json_valid(NEW.snapshot_json) THEN json_extract(NEW.snapshot_json, '$.title') END, ''), NEW.head_branch || ' ' || NEW.repo_slug FROM search_docs WHERE id = 'mountpr:' || NEW.id;
END;

CREATE TRIGGER search_mount_pr_delete AFTER DELETE ON mount_pr_links BEGIN
  DELETE FROM search_docs WHERE id = 'mountpr:' || OLD.id;
END;

CREATE TRIGGER search_branch_insert AFTER INSERT ON session_worktrees BEGIN
  DELETE FROM search_docs WHERE id = 'branch:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'branch:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'branch', NEW.id, NULL, NEW.session_id,
    NULL, NEW.id, NEW.project_id,
    NULL, NEW.repo_slug, CASE WHEN NEW.is_attached = 1 THEN 'attached' ELSE 'detached' END,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.branch, COALESCE(NEW.mount_name, '') FROM search_docs WHERE id = 'branch:' || NEW.id;
END;

CREATE TRIGGER search_branch_update AFTER UPDATE OF branch, mount_name, project_id, repo_slug, is_attached ON session_worktrees BEGIN
  DELETE FROM search_docs WHERE id IN ('branch:' || OLD.id, 'branch:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'branch:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'branch', NEW.id, NULL, NEW.session_id,
    NULL, NEW.id, NEW.project_id,
    NULL, NEW.repo_slug, CASE WHEN NEW.is_attached = 1 THEN 'attached' ELSE 'detached' END,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.branch, COALESCE(NEW.mount_name, '') FROM search_docs WHERE id = 'branch:' || NEW.id;
END;

CREATE TRIGGER search_branch_delete AFTER DELETE ON session_worktrees BEGIN
  DELETE FROM search_docs WHERE id = 'branch:' || OLD.id;
END;

CREATE TRIGGER search_workflow_insert AFTER INSERT ON workflows BEGIN
  DELETE FROM search_docs WHERE id = 'workflow:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'workflow:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'workflow', NEW.id, NEW.workspace_id, NULL,
    NULL, NULL, NULL,
    NULL, NULL, CASE WHEN NEW.deleted_at IS NOT NULL THEN 'deleted' END,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.name, TRIM(COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.goal, '')) FROM search_docs WHERE id = 'workflow:' || NEW.id;
END;

CREATE TRIGGER search_workflow_update AFTER UPDATE OF name, description, goal, deleted_at, workspace_id ON workflows BEGIN
  DELETE FROM search_docs WHERE id IN ('workflow:' || OLD.id, 'workflow:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'workflow:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'workflow', NEW.id, NEW.workspace_id, NULL,
    NULL, NULL, NULL,
    NULL, NULL, CASE WHEN NEW.deleted_at IS NOT NULL THEN 'deleted' END,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.name, TRIM(COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.goal, '')) FROM search_docs WHERE id = 'workflow:' || NEW.id;
END;

CREATE TRIGGER search_workflow_delete AFTER DELETE ON workflows BEGIN
  DELETE FROM search_docs WHERE id = 'workflow:' || OLD.id;
END;

CREATE TRIGGER search_workflow_step_insert AFTER INSERT ON steps BEGIN
  DELETE FROM search_docs WHERE id = 'step:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'step:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'workflow', NEW.workflow_id, NULL, NULL,
    NULL, NULL, NULL,
    NULL, NULL, CASE WHEN NEW.deleted_at IS NOT NULL THEN 'deleted' END,
    0, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.name, COALESCE(NEW.expected_output, '') FROM search_docs WHERE id = 'step:' || NEW.id;
END;

CREATE TRIGGER search_workflow_step_update AFTER UPDATE OF name, expected_output, deleted_at, workflow_id ON steps BEGIN
  DELETE FROM search_docs WHERE id IN ('step:' || OLD.id, 'step:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'step:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'workflow', NEW.workflow_id, NULL, NULL,
    NULL, NULL, NULL,
    NULL, NULL, CASE WHEN NEW.deleted_at IS NOT NULL THEN 'deleted' END,
    0, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.name, COALESCE(NEW.expected_output, '') FROM search_docs WHERE id = 'step:' || NEW.id;
END;

CREATE TRIGGER search_workflow_step_delete AFTER DELETE ON steps BEGIN
  DELETE FROM search_docs WHERE id = 'step:' || OLD.id;
END;

CREATE TRIGGER search_diff_comment_insert AFTER INSERT ON diff_comments BEGIN
  DELETE FROM search_docs WHERE id = 'comment:' || NEW.id;
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'comment:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'comment', NEW.id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NULL, NEW.file_path, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.file_path, NEW.body FROM search_docs WHERE id = 'comment:' || NEW.id;
END;

CREATE TRIGGER search_diff_comment_update AFTER UPDATE OF body, status, file_path ON diff_comments BEGIN
  DELETE FROM search_docs WHERE id IN ('comment:' || OLD.id, 'comment:' || NEW.id);
INSERT INTO search_docs (id, fts_rowid, kind, ref_id, workspace_id, session_id, agent_id, mount_id,
    project_id, provider, container, status, occurred_at, created_at, updated_at)
  SELECT 'comment:' || NEW.id, (SELECT IFNULL(MAX(fts_rowid), 0) + 1 FROM search_docs),
    'comment', NEW.id, NULL, NEW.session_id,
    NULL, NULL, NULL,
    NULL, NEW.file_path, NEW.status,
    NEW.created_at, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE 1;
INSERT INTO search_index (rowid, title, body)
  SELECT fts_rowid, NEW.file_path, NEW.body FROM search_docs WHERE id = 'comment:' || NEW.id;
END;

CREATE TRIGGER search_diff_comment_delete AFTER DELETE ON diff_comments BEGIN
  DELETE FROM search_docs WHERE id = 'comment:' || OLD.id;
END;

CREATE TRIGGER search_linked_issue_delete AFTER DELETE ON session_external_tasks
WHEN NOT EXISTS (
  SELECT 1 FROM session_external_tasks t
   WHERE t.session_id = OLD.session_id
     AND t.provider = OLD.provider
     AND t.external_id = OLD.external_id
)
BEGIN
  DELETE FROM search_docs WHERE id = 'task:' || OLD.session_id || ':' || OLD.provider || ':' || OLD.external_id;
END;
