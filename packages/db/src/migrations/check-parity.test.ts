import {
  CHAT_MESSAGE_ROLES,
  CHAT_MESSAGE_STATUSES,
  CHAT_PROVIDER_IDS,
  CHAT_SESSION_LINK_KINDS,
  CLAUDE_PERMISSION_MODES,
  EXTERNAL_TASK_RELATIONS,
  EXTERNAL_TASK_SCOPES,
  HISTORY_PLAN_STATES,
  SEARCH_KINDS,
  SESSION_DECISION_AUTHORS,
  SESSION_DECISION_STATUSES,
  SESSION_EVENT_KINDS,
} from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { ARTIFACT_REVISION_AUTHORS } from '../queries/artifactRevision';
import { AUTO_APPROVAL_STATES } from '../queries/auto-artifacts';
import { AUTO_ATTEMPT_STATES } from '../queries/auto-attempts';
import { AUTO_DELEGATION_STATES } from '../queries/auto-delegations';
import { AUTO_OUTBOX_KINDS, AUTO_OUTBOX_STATES } from '../queries/auto-outbox';
import { AUTO_RESERVATION_OWNER_KINDS } from '../queries/auto-reservations';
import { AUTO_PHASES, AUTO_STOP_STATES } from '../queries/auto-trees';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

type Values = ReadonlyArray<string>;

const CHECKED_CONSTANTS: Readonly<Record<string, Values>> = {
  'artifact_revisions.author': ARTIFACT_REVISION_AUTHORS,
  'auto_artifacts.approval_state': AUTO_APPROVAL_STATES,
  'auto_attempts.state': AUTO_ATTEMPT_STATES,
  'auto_delegations.state': AUTO_DELEGATION_STATES,
  'auto_outbox.kind': AUTO_OUTBOX_KINDS,
  'auto_outbox.state': AUTO_OUTBOX_STATES,
  'auto_reservations.owner_kind': AUTO_RESERVATION_OWNER_KINDS,
  'auto_trees.phase': AUTO_PHASES,
  'auto_trees.stop_state': AUTO_STOP_STATES,
  'chat_messages.role': CHAT_MESSAGE_ROLES,
  'chat_messages.status': CHAT_MESSAGE_STATUSES,
  'chat_session_links.kind': CHAT_SESSION_LINK_KINDS,
  'chats.provider': CHAT_PROVIDER_IDS,
  'history_plans.state': HISTORY_PLAN_STATES,
  'search_docs.kind': SEARCH_KINDS,
  'session_decisions.author': SESSION_DECISION_AUTHORS,
  'session_decisions.status': SESSION_DECISION_STATUSES,
  'session_events.kind': SESSION_EVENT_KINDS,
  'session_external_tasks.relation': EXTERNAL_TASK_RELATIONS,
  'session_external_tasks.scope': EXTERNAL_TASK_SCOPES,
  'workspaces.default_permission_mode': CLAUDE_PERMISSION_MODES,
};

const UNLINKED_CHECKS: ReadonlyArray<string> = [
  'agent_turn_spans.end_reason',
  'artifact_comments.status',
  'artifact_provenance.kind',
  'artifact_provenance.phase',
  'auto_artifacts.kind',
  'auto_artifacts.owner_role',
  'auto_delegations.role',
  'auto_reservations.state',
  'budget_alerts.kind',
  'budget_rules.period',
  'context_slot_history.author',
  'diff_comments.author_kind',
  'diff_comments.line_side',
  'diff_comments.status',
  'file_versions.change_kind',
  'file_versions.snapshot_source',
  'integration_drafts.status',
  'messages.role',
  'mount_operations.kind',
  'mount_operations.status',
  'mount_pr_links.provider',
  'mount_pr_links.state',
  'open_questions.status',
  'permission_rules.scope',
  'pr_review_drafts.provider',
  'pr_series_members.status',
  'project_sentry_links.source',
  'projects.default_verbosity',
  'projects.goodboy_ignore',
  'projects.kind',
  'provider_limits.status',
  'provider_runs.status_kind',
  'resolve_attempts.phase',
  'resolve_candidates.state',
  'resolve_check_runs.breadth',
  'resolve_check_runs.outcome',
  'resolve_publication_threads.reply_phase',
  'resolve_publication_threads.resolve_phase',
  'resolve_publications.phase',
  'resolve_queue_items.approval_state',
  'resolve_threads.closed_source',
  'resolve_threads.disposition',
  'resolve_threads.origin_kind',
  'resolve_threads.source_kind',
  'resolve_threads.stage',
  'resolve_threads.state',
  'retained_worktree_paths.reason',
  'security_findings.subject_kind',
  'session_artifacts.kind',
  'session_artifacts.source_format',
  'session_artifacts.status',
  'session_budgets.on_exceed',
  'session_context_items.status',
  'session_worktrees.branch_origin',
  'session_worktrees.disk_state',
  'sessions.state_kind',
  'telemetry_records.kind',
  'workspaces.default_verbosity',
  'worktree_roots.added_by',
];

const CHECK_IN_LIST = /CHECK\s*\(\s*([a-z_][a-z0-9_]*)\s+IN\s*\(([^)]*)\)/g;
const QUOTED = /'([^']*)'/g;

type SchemaRow = {
  readonly name: string;
  readonly sql: string;
};

const readChecks = async (): Promise<ReadonlyMap<string, Values>> => {
  const db = await makeMigratedTestDatabase();
  const rows = await db.select<SchemaRow>(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL ORDER BY name",
  );
  const checks = new Map<string, Values>();
  for (const row of rows) {
    for (const match of row.sql.matchAll(CHECK_IN_LIST)) {
      const values = [...(match[2] ?? '').matchAll(QUOTED)].flatMap((quoted) =>
        quoted[1] === undefined ? [] : [quoted[1]],
      );
      if (values.length > 0) {
        checks.set(`${row.name}.${match[1]}`, values);
      }
    }
  }
  return checks;
};

type MismatchParams = {
  readonly checks: ReadonlyMap<string, Values>;
  readonly constants: Readonly<Record<string, Values>>;
};

const mismatchesOf = ({ checks, constants }: MismatchParams): ReadonlyArray<string> =>
  Object.entries(constants).flatMap(([column, constant]) => {
    const inSchema = checks.get(column);
    if (inSchema === undefined) {
      return [`${column}: no CHECK list in the migrated schema`];
    }
    const missingInSchema = constant.filter((value) => !inSchema.includes(value));
    const missingInConstant = inSchema.filter((value) => !constant.includes(value));
    return missingInSchema.length === 0 && missingInConstant.length === 0
      ? []
      : [
          `${column}: constant has ${JSON.stringify(missingInSchema)} the CHECK refuses, CHECK has ${JSON.stringify(missingInConstant)} the constant lacks`,
        ];
  });

const sorted = (values: Values): Values => [...values].sort();

describe('CHECK lists against their constants', () => {
  it('holds the same values in the schema and in the constant, in both directions', async () => {
    const checks = await readChecks();
    const mismatches = mismatchesOf({ checks, constants: CHECKED_CONSTANTS });

    expect(
      mismatches,
      'A constant and its CHECK list moved apart. Change both, with a migration for the CHECK.',
    ).toEqual([]);
  });

  it('leaves no string CHECK list outside the map or the baseline, and the baseline only falls', async () => {
    const checks = await readChecks();
    const unlinked = [...checks.keys()]
      .filter((column) => CHECKED_CONSTANTS[column] === undefined)
      .sort();

    expect(
      unlinked,
      'A new string CHECK list needs a constant in CHECKED_CONSTANTS. Never add to UNLINKED_CHECKS; remove a line when its column gets a constant.',
    ).toEqual(sorted(UNLINKED_CHECKS));
  });

  it('fails when a constant gains a value the CHECK does not know', async () => {
    const checks = await readChecks();
    const mismatches = mismatchesOf({
      checks,
      constants: { 'auto_trees.stop_state': [...AUTO_STOP_STATES, 'parked'] },
    });

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toContain('auto_trees.stop_state');
    expect(mismatches[0]).toContain('parked');
  });

  it('reads a CHECK list that spans lines and ignores numeric lists', () => {
    const sql = `CREATE TABLE t (
      phase TEXT NOT NULL CHECK (
        phase IN ('a', 'b')
      ),
      flag INTEGER CHECK (flag IN (0, 1))
    )`;
    const found = [...sql.matchAll(CHECK_IN_LIST)].map((match) => [
      match[1],
      [...(match[2] ?? '').matchAll(QUOTED)].length,
    ]);

    expect(found).toEqual([
      ['phase', 2],
      ['flag', 0],
    ]);
  });
});
