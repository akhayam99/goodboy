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
  SessionEvent,
  SessionId,
  SessionProjectMount,
  TurnEvent,
  WireframeArtifact,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import type {
  WireframeDocument,
  WireframeNode,
  WireframeScreen,
  WireframeTheme,
  WireframeTransition,
} from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

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
const WIREFRAME_AGENT_ID = 'mock-artifact-agent-wireframe' as AgentId;
const SCOUTING_WIREFRAME_AGENT_ID = 'mock-artifact-agent-wireframe-scouting' as AgentId;
export const SCOUTING_WIREFRAME_RUN_TITLE = 'Deliveries screen, high fidelity';
const SCREENS_SCOUT_AGENT_ID = 'mock-artifact-agent-scout-screens' as AgentId;
const DATA_SCOUT_AGENT_ID = 'mock-artifact-agent-scout-data' as AgentId;

export const REPORT_ARTIFACT_ID = 'mock-artifact-report-summary' as ArtifactId;
const CHANGE_REPORT_ARTIFACT_ID = 'mock-artifact-report-change' as ArtifactId;
export const WIREFRAME_LOW_ARTIFACT_ID = 'mock-artifact-wireframe-low' as ArtifactId;
export const WIREFRAME_HIGH_ARTIFACT_ID = 'mock-artifact-wireframe-high' as ArtifactId;
const PLAN_ARTIFACT_ID = 'mock-artifact-plan-rounding' as ArtifactId;
const PLAN_ID = 'mock-artifact-plan-rounding' as PlanId;
const OLD_PLAN_ID = 'mock-artifact-plan-backfill' as PlanId;

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });
const EARLIER = clock.iso({ at: '2026-09-14T15:02:00.000Z' });

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
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const PROJECTS: ReadonlyArray<Project> = [
  {
    id: LEDGER_ID,
    workspaceId: WORKSPACE_ID,
    name: 'payments-api',
    rootPath: '~/code/harborline/payments-api',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
  {
    id: RELAY_ID,
    workspaceId: WORKSPACE_ID,
    name: 'notify-relay',
    rootPath: '~/code/harborline/notify-relay',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
];

const LEDGER_MOUNT: SessionProjectMount = {
  projectId: LEDGER_ID,
  mountName: 'payments-api',
  worktreePath: '~/code/harborline/payments-api-duplicate-credit',
  repoRoot: '~/code/harborline/payments-api',
  branch: 'hl/fix-duplicate-credit',
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
  worktreePath: '~/code/harborline/notify-relay-retry-state',
  repoRoot: '~/code/harborline/notify-relay',
  branch: 'hl/surface-retry-state',
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

export const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Stop retried webhooks posting a second credit',
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
    name: 'Trace where a retried webhook posts',
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'Found the second credit: the handler checks the event id before the transaction opens.',
    startedAt: clock.iso({ at: '2026-09-14T15:04:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T15:19:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T15:19:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T15:19:00.000Z' }),
  },
  {
    id: PLANNER_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 1,
    name: 'Plan the event id dedupe',
    kind: 'planner',
    status: 'completed',
    outputSummary: 'Planned the dedupe inside the transaction and the retry count in notify-relay.',
    startedAt: clock.iso({ at: '2026-09-14T15:20:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
  },
  {
    id: IMPLEMENTER_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 2,
    name: 'Dedupe on the event id in payments-api',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'Moved the event id check into the credit transaction.',
    startedAt: clock.iso({ at: '2026-09-14T15:32:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T16:04:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T16:04:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T16:04:00.000Z' }),
  },
  {
    id: TESTER_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 3,
    name: 'Replay one event three times',
    kind: 'tester',
    status: 'completed',
    outputSummary: 'Added 8 redelivery cases, including the triple delivery from the Sentry trace.',
    startedAt: clock.iso({ at: '2026-09-14T16:05:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T16:18:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T16:18:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T16:18:00.000Z' }),
  },
  {
    id: CHANGE_REPORT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 4,
    name: 'Report the local change',
    kind: 'report',
    status: 'completed',
    outputSummary: 'Read both worktrees and wrote the local change report.',
    startedAt: clock.iso({ at: '2026-09-14T16:19:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T16:22:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T16:22:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T16:22:00.000Z' }),
  },
  {
    id: REPORT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 5,
    name: 'Report the session outcome',
    kind: 'report',
    status: 'completed',
    outputSummary: 'Wrote the session summary from the run evidence.',
    startedAt: clock.iso({ at: '2026-09-14T16:24:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T16:27:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T16:27:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T16:27:00.000Z' }),
  },
  {
    id: WIREFRAME_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 6,
    name: 'Sketch the deliveries screen',
    kind: 'wireframe',
    status: 'completed',
    outputSummary: 'Drew four screens for the delivery console, with attempts and a stuck flag.',
    startedAt: clock.iso({ at: '2026-09-14T16:28:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T16:38:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T16:38:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-09-14T16:38:00.000Z' }),
  },
  {
    id: SCOUTING_WIREFRAME_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 7,
    name: SCOUTING_WIREFRAME_RUN_TITLE,
    kind: 'wireframe',
    status: 'running',
    startedAt: clock.iso({ at: '2026-09-14T16:39:00.000Z' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5',
  },
  {
    id: SCREENS_SCOUT_AGENT_ID,
    sessionId: SESSION_ID,
    parentAgentId: SCOUTING_WIREFRAME_AGENT_ID,
    ordinal: 8,
    name: 'screens and routes',
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'the delivery list already renders the status in notify-relay/console/Deliveries.tsx',
    startedAt: clock.iso({ at: '2026-09-14T16:39:00.000Z' }),
    completedAt: clock.iso({ at: '2026-09-14T16:39:14.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-09-14T16:39:14.000Z' }),
  },
  {
    id: DATA_SCOUT_AGENT_ID,
    sessionId: SESSION_ID,
    parentAgentId: SCOUTING_WIREFRAME_AGENT_ID,
    ordinal: 9,
    name: 'data and contracts',
    kind: 'scout',
    status: 'running',
    startedAt: clock.iso({ at: '2026-09-14T16:39:00.000Z' }),
  },
];

const PLAN_BODY = `## Approach

Check the processor event id inside the credit transaction instead of in the
handler, so a redelivery that lands mid-write cannot post a second credit.

## Steps

1. Keep the processor event id on every credit row in \`credits/schema.ts\`.
2. Move the duplicate check from \`webhooks/applyWebhook.ts\` into \`credits/applyCredit.ts\`, inside the transaction.
3. Record the attempts on each delivery in \`notify-relay\`.

## Risks

- A unique index on a busy table, so it is added concurrently.`;

const REPORT_BODY = `# Retried webhooks no longer double credit

When the processor redelivered a webhook, \`payments-api\` could credit the same
account twice. This session found where the second credit was written, moved the
check inside the transaction, and let support see each retry in \`notify-relay\`.

## What was wrong

The handler looked for the event id before the credit transaction opened. A
redelivery that landed while the first delivery was still writing passed that
check, and both deliveries posted a credit.

### Where it came from

The check predates the processor's retry policy. It held while each event
arrived once, and nothing failed loudly when retries started.

## What changed

| Area | Before | After | Notes |
| --- | --- | --- | --- |
| event id check | in the handler | in the transaction | unique on the processor event id |
| credit rows | no event id | event id on every row | older rows left as they are |
| retry visibility | hidden | attempts per delivery | shown in the console |
| test coverage | 11 cases | 19 cases | one event delivered three times |

The credit writer now dedupes inside the transaction:

\`\`\`ts
const applyCredit = async ({ tx, event }: ApplyCreditArgs): Promise<CreditResult> => {
  const seen = await tx.credits.findByEventId(event.id);
  if (seen !== null) {
    return { kind: 'duplicate', creditId: seen.id };
  }
  const credit = await tx.credits.insert({ ...creditOf(event), eventId: event.id });
  return { kind: 'credited', creditId: credit.id };
};
\`\`\`

## Evidence

- \`payments-api\` at \`e83d1a0\`: 3 files changed, 47 additions, 12 deletions.
- \`notify-relay\` at \`c52b7e9\`: 3 files changed, 41 additions, 6 deletions.
- The redelivery test sends \`evt_7Qm2\` three times and gets one credit.

> \`ledger-core\` was read, not changed. It already rejects a second posting for
> the same event id.

## Sources

- Dedupe on the event id in payments-api (Implementer)
- Replay one event three times (Tester)
- Dedupe on the event id (Plan)

## Open questions

1. How many failed retries should raise the stuck-delivery banner?
2. Do older credit rows without an event id need a cleanup?

## Next steps

- Answer the banner question before #57 merges.
- Watch Sentry for \`DuplicateCreditError\` for a week after the deploy.
- Remove the handler check once no caller relies on it.`;

const CHANGE_REPORT_BODY = `# Local change report

Two mounts carry local work for this session. Everything below was read from the
worktrees on disk: nothing has been pushed and nothing has been reviewed.

## payments-api

Branch \`hl/fix-duplicate-credit\` off \`main\`, 3 commits ahead, head \`e83d1a0\`.

| Commit | Subject |
| --- | --- |
| \`e83d1a0\` | fix(webhooks): dedupe on the event id inside the transaction |
| \`7a19c40\` | feat(credits): keep the processor event id on every row |
| \`2d5f8be\` | test(webhooks): replay one event three times |

3 files changed, 47 additions, 12 deletions. The credit writer checks the event
id inside the transaction.

## notify-relay

Branch \`hl/surface-retry-state\` off \`main\`, 1 commit ahead, head \`c52b7e9\`.

3 files changed, 41 additions, 6 deletions. Every delivery now records how many
attempts it took.

## Checks that ran

- Unit tests in \`payments-api\`: 19 webhook cases, all green.
- Typecheck in both worktrees: green.

## Risk a reviewer should read first

The unique index on the event id turns a late retry into a constraint error
before the handler sees it, so \`applyCredit\` is the first thing to read.

## Sources

- Dedupe on the event id in payments-api (Implementer)
- Replay one event three times (Tester)`;

const REPORT_KICKOFF = `# evidence pack: Session summary

write a session summary: what the session set out to do, what landed, what is still open.
scope: the whole session. captured at ${clock.iso({ at: '2026-09-14T16:20:00.000Z' })}.
session ${SESSION_ID}: ${SESSION.goal}

this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.

## agents

- ${SCOUT_AGENT_ID} scout "Trace where a retried webhook posts": the handler checks the event id before the transaction opens.
- ${PLANNER_AGENT_ID} planner "Plan the event id dedupe": check the event id inside the transaction, record attempts in notify-relay.
- ${IMPLEMENTER_AGENT_ID} implementer "Dedupe on the event id in payments-api": the event id check moved into the credit transaction.
- ${TESTER_AGENT_ID} tester "Replay one event three times": 8 new redelivery cases, including the triple delivery from the Sentry trace.

## artifacts

- ${PLAN_ARTIFACT_ID} plan "Dedupe on the event id" (consumed).

## diff

payments-api off main, head e83d1a0, 3 files changed, 47 additions, 12 deletions.

## truncation

nothing was truncated.`;

const CHANGE_REPORT_KICKOFF = `# evidence pack: Local change report

write a local change report: the local change as a reviewer reads it: branch commits, diff, checks that ran, risk.
scope: the whole session. captured at ${clock.iso({ at: '2026-09-14T16:19:00.000Z' })}.
session ${SESSION_ID}: ${SESSION.goal}

this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.

## diff

payments-api off main, head e83d1a0, 3 files changed, 47 additions, 12 deletions.
notify-relay off main, head c52b7e9, 3 files changed, 41 additions, 6 deletions.

## truncation

nothing was truncated.`;

const WIREFRAME_KICKOFF = `# evidence pack: Wireframe

draft a plain wireframe of the flow this session produced.
scope: the whole session. captured at ${clock.iso({ at: '2026-09-14T16:28:00.000Z' })}.
session ${SESSION_ID}: ${SESSION.goal}

this pack is the only evidence you have. it carries final agent messages, not tool calls or tool output. never invent a fact that is not here; say plainly what is missing.

## agents

- ${SCOUT_AGENT_ID} scout "Trace where a retried webhook posts": the handler checks the event id before the transaction opens.
- ${IMPLEMENTER_AGENT_ID} implementer "Dedupe on the event id in payments-api": the event id check moved into the credit transaction.

## artifacts

- ${PLAN_ARTIFACT_ID} plan "Dedupe on the event id" (consumed).
- ${REPORT_ARTIFACT_ID} report "Retried webhooks no longer double credit" (active).

## design profile

no design evidence was collected for this run, so the theme is generic.

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
  title: 'Retried webhooks no longer double credit',
  sourceFormat: 'markdown',
  sourceText: REPORT_BODY,
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: 'mock-artifact-turn-report',
  createdAt: clock.iso({ at: '2026-09-14T16:27:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-14T16:27:00.000Z' }),
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
  createdAt: clock.iso({ at: '2026-09-14T16:22:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-14T16:22:00.000Z' }),
};

const PLAN_ARTIFACT: SessionArtifact = {
  id: PLAN_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: PLANNER_AGENT_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Dedupe on the event id',
  sourceFormat: 'markdown',
  sourceText: PLAN_BODY,
  metadata: {},
  status: 'consumed',
  revision: 1,
  sourceTurnId: 'mock-artifact-turn-plan',
  createdAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
};

const BATCHES_CHILDREN: ReadonlyArray<WireframeNode> = [
  {
    id: 'batches-nav',
    kind: 'navigation',
    variant: 'top',
    items: [
      { id: 'nav-batches', label: 'Batches', isActive: true },
      {
        id: 'nav-exceptions',
        label: 'Exceptions',
        action: { type: 'navigate', toScreenId: 'exception' },
      },
      { id: 'nav-audit', label: 'Audit', action: { type: 'navigate', toScreenId: 'audit' } },
    ],
  },
  { id: 'batches-title', kind: 'text', text: 'Settlement batches', variant: 'title' },
  {
    id: 'batches-filter',
    kind: 'stack',
    direction: 'row',
    gap: 'sm',
    align: 'center',
    children: [
      { id: 'batches-search', kind: 'input', inputType: 'search', placeholder: 'Find a batch' },
      {
        id: 'batches-toggle-settled',
        kind: 'button',
        label: 'Show settled',
        variant: 'ghost',
        action: { type: 'toggle', stateKey: 'showSettled' },
      },
    ],
  },
  {
    id: 'batches-list',
    kind: 'list',
    items: [
      {
        id: 'batch-4471',
        title: 'Batch 4471',
        subtitle: '128 postings, 2 cents out',
        action: { type: 'navigate', toScreenId: 'review' },
      },
      {
        id: 'batch-4470',
        title: 'Batch 4470',
        subtitle: '96 postings, balanced',
        action: { type: 'navigate', toScreenId: 'review' },
      },
      {
        id: 'batch-4469',
        title: 'Batch 4469',
        subtitle: '204 postings, 1 cent out',
        action: { type: 'navigate', toScreenId: 'exception' },
      },
    ],
  },
];

const BATCHES_METRICS: WireframeNode = {
  id: 'batches-metrics',
  kind: 'grid',
  columns: 3,
  gap: 'sm',
  children: [
    {
      id: 'metric-open',
      kind: 'stack',
      direction: 'column',
      gap: 'sm',
      padding: 'sm',
      surface: true,
      children: [
        { id: 'metric-open-label', kind: 'text', text: 'Out of balance', variant: 'label' },
        { id: 'metric-open-value', kind: 'text', text: '3 batches', variant: 'title' },
      ],
    },
    {
      id: 'metric-settled',
      kind: 'stack',
      direction: 'column',
      gap: 'sm',
      padding: 'sm',
      surface: true,
      children: [
        { id: 'metric-settled-label', kind: 'text', text: 'Settled today', variant: 'label' },
        { id: 'metric-settled-value', kind: 'text', text: '128 batches', variant: 'title' },
      ],
    },
    { id: 'batches-hero', kind: 'image', alt: 'Settlement health chart', ratio: 'wide' },
  ],
};

const batchesScreen = ({
  children,
}: {
  readonly children: ReadonlyArray<WireframeNode>;
}): WireframeScreen => ({
  id: 'batches',
  title: 'Settlement batches',
  viewport: 'desktop',
  note: 'The operator lands here after signing in.',
  states: {
    showSettled: {
      label: 'Settled shown',
      hide: [],
      show: [],
      text: { 'batches-toggle-settled': 'Hide settled' },
    },
  },
  root: {
    id: 'batches-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children,
  },
});

const REVIEW_SCREEN: WireframeScreen = {
  id: 'review',
  title: 'Review batch',
  viewport: 'desktop',
  note: 'Opened from a batch row.',
  states: {
    error: {
      label: 'Error',
      hide: [],
      show: [],
      text: { 'review-title': 'Batch 4471 could not load' },
    },
  },
  root: {
    id: 'review-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children: [
      { id: 'review-title', kind: 'text', text: 'Batch 4471', variant: 'title' },
      {
        id: 'review-summary',
        kind: 'text',
        text: 'The allocation total is two cents under the invoice total.',
        variant: 'body',
      },
      {
        id: 'review-table',
        kind: 'table',
        columns: ['Posting', 'Account', 'Allocated', 'Rounded'],
        rows: [
          ['P-1', 'Receivables', '33.34', '33.33'],
          ['P-2', 'Receivables', '33.33', '33.33'],
          ['P-3', 'Fees', '33.33', '33.33'],
        ],
      },
      {
        id: 'review-actions',
        kind: 'stack',
        direction: 'row',
        gap: 'sm',
        justify: 'between',
        children: [
          {
            id: 'review-back',
            kind: 'button',
            label: 'Back to batches',
            variant: 'ghost',
            action: { type: 'navigate', toScreenId: 'batches' },
          },
          {
            id: 'review-escalate',
            kind: 'button',
            label: 'Escalate',
            variant: 'danger',
            action: { type: 'navigate', toScreenId: 'exception' },
          },
          {
            id: 'review-release',
            kind: 'button',
            label: 'Release batch',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'audit' },
          },
        ],
      },
    ],
  },
};

const EXCEPTION_SCREEN: WireframeScreen = {
  id: 'exception',
  title: 'Exception detail',
  viewport: 'desktop',
  root: {
    id: 'exception-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children: [
      { id: 'exception-title', kind: 'text', text: 'Rounding exception', variant: 'title' },
      {
        id: 'exception-note',
        kind: 'text',
        text: 'Three allocations rounded down, so the batch total is short.',
        variant: 'body',
      },
      {
        id: 'exception-reason',
        kind: 'input',
        inputType: 'textarea',
        label: 'Reason',
        placeholder: 'Why is this being accepted?',
      },
      {
        id: 'exception-owner',
        kind: 'input',
        inputType: 'select',
        label: 'Assign to',
        options: ['Settlements', 'Invoicing', 'Platform'],
      },
      {
        id: 'exception-actions',
        kind: 'stack',
        direction: 'row',
        gap: 'sm',
        children: [
          {
            id: 'exception-cancel',
            kind: 'button',
            label: 'Back to review',
            variant: 'ghost',
            action: { type: 'navigate', toScreenId: 'review' },
          },
          {
            id: 'exception-accept',
            kind: 'button',
            label: 'Accept and log',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'audit' },
          },
        ],
      },
    ],
  },
};

const AUDIT_SCREEN: WireframeScreen = {
  id: 'audit',
  title: 'Audit trail',
  viewport: 'desktop',
  root: {
    id: 'audit-root',
    kind: 'stack',
    direction: 'column',
    gap: 'md',
    padding: 'md',
    children: [
      { id: 'audit-title', kind: 'text', text: 'Audit trail', variant: 'title' },
      {
        id: 'audit-table',
        kind: 'table',
        columns: ['When', 'Who', 'Action'],
        rows: [
          ['16:31', 'Operator', 'Released batch 4471'],
          ['16:12', 'Operator', 'Accepted a rounding exception'],
          ['15:58', 'System', 'Flagged batch 4469'],
        ],
      },
      {
        id: 'audit-back',
        kind: 'button',
        label: 'Back to batches',
        variant: 'secondary',
        action: { type: 'navigate', toScreenId: 'batches' },
      },
    ],
  },
};

const WIREFRAME_TRANSITIONS: ReadonlyArray<WireframeTransition> = [
  { fromNodeId: 'batch-4471', toScreenId: 'review', label: 'open a batch' },
  { fromNodeId: 'batch-4469', toScreenId: 'exception', label: 'open a flagged batch' },
  { fromNodeId: 'review-release', toScreenId: 'audit', label: 'release' },
  { fromNodeId: 'review-escalate', toScreenId: 'exception', label: 'escalate' },
  { fromNodeId: 'exception-accept', toScreenId: 'audit', label: 'accept and log' },
  { fromNodeId: 'audit-back', toScreenId: 'batches', label: 'back to the list' },
  { fromNodeId: 'nav-exceptions', toScreenId: 'exception', label: 'exceptions tab' },
  { fromNodeId: 'nav-audit', toScreenId: 'audit', label: 'audit tab' },
];

const HIGH_THEME: WireframeTheme = {
  name: 'harborline-console',
  font: 'sans',
  radius: 'lg',
  colors: {
    background: '#0d1117',
    surface: '#161b22',
    foreground: '#e6edf3',
    muted: '#8b949e',
    border: '#30363d',
    accent: '#2f81f7',
    accentForeground: '#ffffff',
    danger: '#f85149',
  },
  sources: ['notify-relay/console/styles/tokens.css', 'notify-relay/console/components/Button.tsx'],
};

const WIREFRAME_LOW_DOCUMENT: WireframeDocument = {
  version: 2,
  initialScreenId: 'batches',
  theme: { name: 'generic', font: 'sans', radius: 'md' },
  screens: [
    batchesScreen({ children: BATCHES_CHILDREN }),
    REVIEW_SCREEN,
    EXCEPTION_SCREEN,
    AUDIT_SCREEN,
  ],
  transitions: WIREFRAME_TRANSITIONS,
};

const WIREFRAME_HIGH_DOCUMENT: WireframeDocument = {
  ...WIREFRAME_LOW_DOCUMENT,
  theme: HIGH_THEME,
  screens: [
    batchesScreen({
      children: [...BATCHES_CHILDREN.slice(0, 2), BATCHES_METRICS, ...BATCHES_CHILDREN.slice(2)],
    }),
    REVIEW_SCREEN,
    EXCEPTION_SCREEN,
    AUDIT_SCREEN,
  ],
};

const WIREFRAME_LOW_ARTIFACT: WireframeArtifact = {
  id: WIREFRAME_LOW_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: WIREFRAME_AGENT_ID,
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Deliveries screen',
  sourceFormat: 'json',
  sourceText: JSON.stringify(WIREFRAME_LOW_DOCUMENT, null, 2),
  metadata: { fidelity: 'low', designProfile: {} },
  status: 'active',
  revision: 1,
  sourceTurnId: 'mock-artifact-turn-wireframe-low',
  createdAt: clock.iso({ at: '2026-09-14T16:34:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-14T16:34:00.000Z' }),
};

const WIREFRAME_HIGH_ARTIFACT: WireframeArtifact = {
  id: WIREFRAME_HIGH_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: WIREFRAME_AGENT_ID,
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Deliveries screen, themed',
  sourceFormat: 'json',
  sourceText: JSON.stringify(WIREFRAME_HIGH_DOCUMENT, null, 2),
  metadata: {
    fidelity: 'high',
    designProfile: {
      themeName: 'harborline-console',
      commitSha: 'c52b7e9',
      sources: [
        'notify-relay/console/styles/tokens.css',
        'notify-relay/console/components/Button.tsx',
        'notify-relay/console/tailwind.config.ts',
      ],
    },
  },
  status: 'active',
  revision: 3,
  sourceTurnId: 'mock-artifact-turn-wireframe-high',
  createdAt: clock.iso({ at: '2026-09-14T16:38:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-14T16:38:00.000Z' }),
};

const SESSION_EVENTS = [
  {
    id: 'mock-artifact-event-branch',
    sessionId: SESSION_ID,
    kind: 'branch_created',
    payload: { branch: LEDGER_MOUNT.branch, projectName: LEDGER_MOUNT.mountName },
    createdAt: clock.iso({ at: '2026-09-14T15:00:00.000Z' }),
  },
  {
    id: 'mock-artifact-event-pr',
    sessionId: SESSION_ID,
    kind: 'pr_created',
    payload: {
      number: 318,
      title: 'Stop retried webhooks posting a second credit',
      url: 'https://example.invalid/pr/318',
    },
    createdAt: clock.iso({ at: '2026-09-14T16:12:00.000Z' }),
  },
] as unknown as ReadonlyArray<SessionEvent>;

const ARTIFACTS: ReadonlyArray<SessionArtifact> = [
  PLAN_ARTIFACT,
  REPORT_ARTIFACT,
  CHANGE_REPORT_ARTIFACT,
  WIREFRAME_LOW_ARTIFACT,
  WIREFRAME_HIGH_ARTIFACT,
];

const ACTIVE_PLAN_BODY = `## Approach

Show the attempts on each delivery in the \`notify-relay\` console, with a stuck
flag once a delivery keeps failing.

## Steps

1. Read the attempts from the typed delivery endpoint.
2. Add an attempts column to the deliveries table.
3. Flag a delivery as stuck after the third failed retry.
4. Name the stuck event in a banner above the filters.

## Done when

- The console shows attempts for every delivery
- A stuck delivery shows in the banner within a minute
`;

const PLANS: ReadonlyArray<PlanWithCount> = [
  {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    title: 'Dedupe on the event id',
    bodyMd: PLAN_BODY,
    status: 'consumed',
    createdAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
    updatedAt: clock.iso({ at: '2026-09-14T15:31:00.000Z' }),
    consumptionCount: 1,
  },
  {
    id: 'mock-artifact-plan-half-cent' as PlanId,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    title: 'Replay one event three times',
    bodyMd: 'Deliver evt_7Qm2 three times and expect one credit and three 200 responses.',
    status: 'consumed',
    createdAt: clock.iso({ at: '2026-09-14T15:40:00.000Z' }),
    updatedAt: clock.iso({ at: '2026-09-14T15:40:00.000Z' }),
    consumptionCount: 1,
  },
  {
    id: OLD_PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    title: 'Show the attempts on each delivery',
    bodyMd: ACTIVE_PLAN_BODY,
    status: 'active',
    createdAt: clock.iso({ at: '2026-09-14T16:34:00.000Z' }),
    updatedAt: clock.iso({ at: '2026-09-14T16:34:00.000Z' }),
    consumptionCount: 0,
  },
];

type SeedParams = Readonly<{
  focusedArtifactId: ArtifactId | null;
}>;

export const seedArtifactScene = ({ focusedArtifactId }: SeedParams) => {
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
        at: clock.iso({ at: '2026-09-14T16:24:00.000Z' }),
      }),
      [CHANGE_REPORT_AGENT_ID]: transcriptOf({
        runId: 'mock-artifact-run-change-report',
        text: CHANGE_REPORT_KICKOFF,
        at: clock.iso({ at: '2026-09-14T16:19:00.000Z' }),
      }),
      [WIREFRAME_AGENT_ID]: transcriptOf({
        runId: 'mock-artifact-run-wireframe',
        text: WIREFRAME_KICKOFF,
        at: clock.iso({ at: '2026-09-14T16:28:00.000Z' }),
      }),
    },
    sessionArtifacts: { [SESSION_ID]: ARTIFACTS },
    wireframeScoutVerification: {
      [SCREENS_SCOUT_AGENT_ID]: { verified: 8, cited: 11 },
    },
    agentTurnState: {
      [DATA_SCOUT_AGENT_ID]: {
        kind: 'running',
        runId: 'mock-artifact-run-scout-data' as ProviderRunId,
        startedAt: NOW,
      },
    },
    sessionPlans: { [SESSION_ID]: PLANS },
    sessionEvents: { [SESSION_ID]: SESSION_EVENTS },
    sessionWorktreeRecords: {
      [SESSION_ID]: MOUNTS.map((mount, index) => ({
        id: `mock-artifact-worktree-${index}`,
        sessionId: SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `harborline/${mount.mountName}`,
        createdAt: Date.parse(EARLIER),
      })),
    },
    sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: SESSION.goal, enabled: true }] },
    sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
    sessionLoading: {
      [SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    sessionDismissedQuestions: { [SESSION_ID]: [] },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    planConsumptions: {},
    focusedArtifactId: { [SESSION_ID]: focusedArtifactId },
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
    loadSessionEvents: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
    navigate: () => undefined,
    loadConsumptionsForPlan: async () => undefined,
    loadAgentTranscript: async () => undefined,
  });
};
