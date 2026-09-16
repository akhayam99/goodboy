import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  MountId,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
  ProviderRunId,
  ReportArtifact,
  Session,
  SessionArtifact,
  SessionId,
  SessionProjectMount,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';

const WORKSPACE_ID = 'mock-artifact-workspace-harborline' as WorkspaceId;
export const SESSION_ID = 'mock-artifact-session-ledger' as SessionId;
const LEDGER_ID = 'mock-artifact-project-ledger-core' as ProjectId;
const RELAY_ID = 'mock-artifact-project-notify-relay' as ProjectId;
const SCOUT_AGENT_ID = 'mock-artifact-agent-scout' as AgentId;
const PLANNER_AGENT_ID = 'mock-artifact-agent-planner' as AgentId;
const IMPLEMENTER_AGENT_ID = 'mock-artifact-agent-implementer' as AgentId;
const TESTER_AGENT_ID = 'mock-artifact-agent-tester' as AgentId;
const REPORT_AGENT_ID = 'mock-artifact-agent-report' as AgentId;
const CHANGE_REPORT_AGENT_ID = 'mock-artifact-agent-change-report' as AgentId;

const REPORT_ARTIFACT_ID = 'mock-artifact-report-summary' as ArtifactId;
const CHANGE_REPORT_ARTIFACT_ID = 'mock-artifact-report-change' as ArtifactId;
const PLAN_ARTIFACT_ID = 'mock-artifact-plan-rounding' as ArtifactId;
const PLAN_ID = 'mock-artifact-plan-rounding' as PlanId;
const OLD_PLAN_ID = 'mock-artifact-plan-backfill' as PlanId;

const NOW = '2026-09-14T16:40:00.000Z' as IsoDateTime;
const EARLIER = '2026-09-14T15:02:00.000Z' as IsoDateTime;

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  sessionsRoot: '/mock/harborline/sessions',
  overrides: OVERRIDES,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const PROJECTS: ReadonlyArray<Project> = [
  {
    id: LEDGER_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    rootPath: '/mock/harborline/ledger-core',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
  {
    id: RELAY_ID,
    workspaceId: WORKSPACE_ID,
    name: 'notify-relay',
    rootPath: '/mock/harborline/notify-relay',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
];

const LEDGER_MOUNT: SessionProjectMount = {
  projectId: LEDGER_ID,
  mountName: 'ledger-core',
  worktreePath: '/mock/harborline/ledger-core-rounding',
  repoRoot: '/mock/harborline/ledger-core',
  branch: 'ak/fix-posting-rounding',
  mountId: 'mock-artifact-mount-ledger' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const RELAY_MOUNT: SessionProjectMount = {
  projectId: RELAY_ID,
  mountName: 'notify-relay',
  worktreePath: '/mock/harborline/notify-relay-backoff',
  repoRoot: '/mock/harborline/notify-relay',
  branch: 'ak/fix-retry-backoff',
  mountId: 'mock-artifact-mount-relay' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const MOUNTS = [LEDGER_MOUNT, RELAY_MOUNT];

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Fix the half-cent rounding drift in ledger-core postings and stop notify-relay from retrying settled batches',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: LEDGER_ID,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: SCOUT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'Trace the rounding drift',
    kind: 'scout',
    status: 'completed',
    outputSummary: 'Found the drift in the per-posting rounding of split allocations.',
    startedAt: '2026-09-14T15:04:00.000Z' as IsoDateTime,
    completedAt: '2026-09-14T15:19:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-14T15:19:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-14T15:19:00.000Z' as IsoDateTime,
  },
  {
    id: PLANNER_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Plan the rounding fix',
    kind: 'planner',
    status: 'completed',
    outputSummary: 'Drafted a banker rounding plan with a backfill for settled batches.',
    startedAt: '2026-09-14T15:20:00.000Z' as IsoDateTime,
    completedAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
  },
  {
    id: IMPLEMENTER_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 2,
    name: 'Apply the rounding fix in ledger-core',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'Moved allocation rounding to the batch total and kept postings balanced.',
    startedAt: '2026-09-14T15:32:00.000Z' as IsoDateTime,
    completedAt: '2026-09-14T16:04:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-14T16:04:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-14T16:04:00.000Z' as IsoDateTime,
  },
  {
    id: TESTER_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 3,
    name: 'Cover the split allocation cases',
    kind: 'tester',
    status: 'completed',
    outputSummary: 'Added 14 allocation cases, including the three cent split that drifted.',
    startedAt: '2026-09-14T16:05:00.000Z' as IsoDateTime,
    completedAt: '2026-09-14T16:18:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-14T16:18:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-14T16:18:00.000Z' as IsoDateTime,
  },
  {
    id: CHANGE_REPORT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 4,
    name: 'Report the local change',
    kind: 'report',
    status: 'completed',
    outputSummary: 'Read both worktrees and wrote the local change report.',
    startedAt: '2026-09-14T16:19:00.000Z' as IsoDateTime,
    completedAt: '2026-09-14T16:22:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-14T16:22:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-14T16:22:00.000Z' as IsoDateTime,
  },
  {
    id: REPORT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 5,
    name: 'Report the session outcome',
    kind: 'report',
    status: 'completed',
    outputSummary: 'Wrote the session summary from the run evidence.',
    startedAt: '2026-09-14T16:24:00.000Z' as IsoDateTime,
    completedAt: '2026-09-14T16:27:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-14T16:27:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-14T16:27:00.000Z' as IsoDateTime,
  },
];

const PLAN_BODY = `## Approach

Round once per batch instead of once per posting, then reconcile the remainder
against the largest allocation so the batch total still balances.

## Steps

1. Move \`roundAllocation\` out of the per posting loop in \`postings/allocate.ts\`.
2. Reconcile the residual cents against the largest allocation.
3. Backfill the settled batches from the last quarter behind a dry run flag.

## Risks

- The backfill touches settled rows, so it runs read only until the totals match.`;

const REPORT_BODY = `# Rounding drift in ledger-core postings

Settlement batches in \`ledger-core\` landed one or two cents away from the
invoice total. This session traced the drift, fixed the allocation path, covered
it with tests, and left the backfill behind a flag.

## What was wrong

Each posting rounded its own share of the batch. With three or more
allocations the rounded shares no longer summed to the batch total, and the
difference was silently absorbed by the last posting written.

### Where it came from

The per posting rounding predates split allocations. It was correct while a
batch carried a single posting, and nothing failed loudly when that stopped
being true.

## What changed

| Area | Before | After | Notes |
| --- | --- | --- | --- |
| allocation rounding | per posting | per batch | residual goes to the largest share |
| settled batches | drift kept | backfilled | dry run until totals match |
| notify-relay retries | retried settled batches | skips settled | keyed on batch state |
| test coverage | 6 cases | 20 cases | split allocations included |

The allocation path now rounds once and reconciles the remainder:

\`\`\`ts
const allocate = ({ total, weights }: AllocateArgs): ReadonlyArray<Cents> => {
  const raw = weights.map((weight) => (total * weight) / sum(weights));
  const rounded = raw.map((value) => Math.round(value));
  const residual = total - sum(rounded);
  return applyResidual({ rounded, residual, index: largestIndex(raw) });
};
\`\`\`

## Evidence

- \`ledger-core\` at \`a41f9c2\`: 9 files changed, 312 additions, 148 deletions.
- \`notify-relay\` at \`7b30e15\`: 4 files changed, 74 additions, 31 deletions.
- 20 allocation cases pass, including the three cent split that drifted.

> The backfill was not run against settled data. It stays in dry run until an
> operator compares the reported totals.

## Sources

- agent ${IMPLEMENTER_AGENT_ID}
- agent ${TESTER_AGENT_ID}
- plan ${PLAN_ARTIFACT_ID}

## Open questions

1. Should the residual go to the largest allocation or the first one? The
   invoice convention this session worked from was never confirmed.
2. Does \`notify-relay\` need to replay the notifications it suppressed while it
   was retrying settled batches?

## Next steps

- Confirm the residual convention before the backfill runs for real.
- Run the backfill in dry run against a copy of last quarter.
- Delete the legacy \`roundAllocation\` helper once no caller remains.`;

const CHANGE_REPORT_BODY = `# Local change report

Two mounts carry local work for this session. Everything below was read from the
worktrees on disk: nothing has been pushed and nothing has been reviewed.

## ledger-core

Branch \`ak/fix-posting-rounding\` off \`main\`, 3 commits ahead, head \`a41f9c2\`.

| Commit | Subject |
| --- | --- |
| \`a41f9c2\` | fix(postings): round once per batch |
| \`5c0e7b1\` | test(postings): cover split allocations |
| \`9d42af8\` | chore(postings): gate the backfill behind a dry run flag |

9 files changed, 312 additions, 148 deletions. The allocation path rounds once
per batch. The backfill script is committed but no scheduler calls it.

## notify-relay

Branch \`ak/fix-retry-backoff\` off \`main\`, 1 commit ahead, head \`7b30e15\`.

4 files changed, 74 additions, 31 deletions. Retries now read batch state before
scheduling the next attempt.

## Checks that ran

- Unit tests in \`ledger-core\`: 20 allocation cases, all green.
- Typecheck in both worktrees: green.
- The backfill was never run against settled data.

## Risk a reviewer should read first

The residual now lands on the largest allocation. That choice is visible in
every settled batch the backfill touches, and no test pins the convention
itself, so \`applyResidual\` is the first thing to read before the backfill
leaves dry run.

## Sources

- agent ${IMPLEMENTER_AGENT_ID}
- agent ${TESTER_AGENT_ID}`;

const REPORT_KICKOFF = `# evidence pack: Session summary

write a session summary: what the session set out to do, what landed, what is still open.
scope: the whole session. captured at 2026-09-14T16:20:00.000Z.
session ${SESSION_ID}: ${SESSION.goal}

this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.

## agents

- ${SCOUT_AGENT_ID} scout "Trace the rounding drift": the drift is in the per posting rounding of split allocations.
- ${PLANNER_AGENT_ID} planner "Plan the rounding fix": round once per batch, reconcile the residual against the largest allocation.
- ${IMPLEMENTER_AGENT_ID} implementer "Apply the rounding fix in ledger-core": rounding moved to the batch total, postings stay balanced.
- ${TESTER_AGENT_ID} tester "Cover the split allocation cases": 14 new allocation cases, including the three cent split.

## artifacts

- ${PLAN_ARTIFACT_ID} plan "Round once per batch" (consumed).

## diff

ledger-core off main, head a41f9c2, 9 files changed, 312 additions, 148 deletions.

## truncation

nothing was truncated.`;

const CHANGE_REPORT_KICKOFF = `# evidence pack: Local change report

write a local change report: the local change as a reviewer reads it: branch commits, diff, checks that ran, risk.
scope: the whole session. captured at 2026-09-14T16:19:00.000Z.
session ${SESSION_ID}: ${SESSION.goal}

this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.

## diff

ledger-core off main, head a41f9c2, 9 files changed, 312 additions, 148 deletions.
notify-relay off main, head 7b30e15, 4 files changed, 74 additions, 31 deletions.

## truncation

nothing was truncated.`;

const transcriptOf = ({
  runId,
  text,
  at,
}: {
  readonly runId: string;
  readonly text: string;
  readonly at: string;
}): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: runId as ProviderRunId,
    text,
    at: at as IsoDateTime,
  },
];

const REPORT_ARTIFACT: ReportArtifact = {
  id: REPORT_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: REPORT_AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core postings',
  sourceFormat: 'markdown',
  sourceText: REPORT_BODY,
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: 'mock-artifact-turn-report',
  createdAt: '2026-09-14T16:27:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-14T16:27:00.000Z' as IsoDateTime,
};

const CHANGE_REPORT_ARTIFACT: ReportArtifact = {
  id: CHANGE_REPORT_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: CHANGE_REPORT_AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Local change report',
  sourceFormat: 'markdown',
  sourceText: CHANGE_REPORT_BODY,
  metadata: { reportType: 'change-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: 'mock-artifact-turn-change-report',
  createdAt: '2026-09-14T16:22:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-14T16:22:00.000Z' as IsoDateTime,
};

const PLAN_ARTIFACT: SessionArtifact = {
  id: PLAN_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: PLANNER_AGENT_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Round once per batch',
  sourceFormat: 'markdown',
  sourceText: PLAN_BODY,
  metadata: {},
  status: 'consumed',
  revision: 1,
  sourceTurnId: 'mock-artifact-turn-plan',
  createdAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
};

const ARTIFACTS: ReadonlyArray<SessionArtifact> = [
  PLAN_ARTIFACT,
  REPORT_ARTIFACT,
  CHANGE_REPORT_ARTIFACT,
];

const PLANS: ReadonlyArray<PlanWithCount> = [
  {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    title: 'Round once per batch',
    bodyMd: PLAN_BODY,
    status: 'consumed',
    createdAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-14T15:31:00.000Z' as IsoDateTime,
    consumptionCount: 1,
  },
  {
    id: OLD_PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    title: 'Backfill the settled batches',
    bodyMd: 'Replay the settled batches from the last quarter behind a dry run flag.',
    status: 'active',
    createdAt: '2026-09-14T15:34:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-14T15:34:00.000Z' as IsoDateTime,
    consumptionCount: 0,
  },
];

export const seedArtifactScene = () => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: PROJECTS,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: { [SESSION_ID]: MOUNTS },
    sessionActiveProject: { [SESSION_ID]: LEDGER_ID },
    sessionWorktrees: { [SESSION_ID]: MOUNTS.map((mount) => mount.worktreePath) },
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    transcripts: {
      [REPORT_AGENT_ID]: transcriptOf({
        runId: 'mock-artifact-run-report',
        text: REPORT_KICKOFF,
        at: '2026-09-14T16:24:00.000Z',
      }),
      [CHANGE_REPORT_AGENT_ID]: transcriptOf({
        runId: 'mock-artifact-run-change-report',
        text: CHANGE_REPORT_KICKOFF,
        at: '2026-09-14T16:19:00.000Z',
      }),
    },
    sessionArtifacts: { [SESSION_ID]: ARTIFACTS },
    sessionPlans: { [SESSION_ID]: PLANS },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    planConsumptions: {},
    focusedPlanId: { [SESSION_ID]: null },
    sessionWorkflows: { [SESSION_ID]: [] },
    phaseTemplates: { [WORKSPACE_ID]: [] },
    sessionTelemetry: { [SESSION_ID]: [] },
    sessionExternalTasks: { [SESSION_ID]: [] },
    summarizerStatus: {
      [SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    },
    activeLens: { [SESSION_ID]: null },
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    sessionAttachments: { [SESSION_ID]: [] },
    slotHistory: { [SESSION_ID]: {} },
    slotHistoryCounts: { [SESSION_ID]: {} },
    loadSessionArtifacts: async () => undefined,
    loadConsumptionsForPlan: async () => undefined,
    selectAgent: async () => undefined,
    setFocusedPlanId: () => undefined,
  });
};
