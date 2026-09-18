import { useEffect, useState } from 'react';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  PrReviewDraft,
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  Session,
  SessionArtifact,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { DiscoveredScriptScan } from '../../../../store/slices/scripts/state';
import type { ScriptGroup, ScriptRunRecord } from '../../../../features/scripts/scripts';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { ShellFrame, seedShellChrome } from './shellChrome';
import { SESSION, SESSION_ID, WORKSPACE_ID, seedResolveScene } from './resolveSeed';

const NOW = '2026-09-04T14:20:00.000Z' as IsoDateTime;
const EARLIER = '2026-09-04T11:05:00.000Z' as IsoDateTime;

const PROJECT_ID = 'mock-resolve-project-billing-api' as ProjectId;
const MOUNT_ID = 'mock-resolve-mount-billing-api' as MountId;
const WORKTREE = '/mock/cascadia/billing-api-webhook-retry';
const BRANCH = 'fix/webhook-retry-backoff';
const PR_NUMBER = 528;
const REPO = 'cascadia/billing-api';

const PLANNER_AGENT_ID = 'mock-lens-agent-planner' as AgentId;
const REPORTER_AGENT_ID = 'mock-lens-agent-reporter' as AgentId;

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: SESSION.workspaceId,
  name: 'billing-api',
  rootPath: '/mock/cascadia/billing-api',
  kind: 'repo',
  baseBranch: 'main',
  overrides: {
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
  },
  createdAt: EARLIER,
  updatedAt: NOW,
};

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'billing-api',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/mock/cascadia/billing-api',
  branch: BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 3,
};

const OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  {
    id: 'mock-lens-question-exhausted-shape' as OpenQuestionId,
    sessionId: SESSION_ID,
    text: 'What should a caller see once the retries are exhausted?',
    suggestedAnswers: [
      'A 200 with a warning header, so the caller stops retrying too',
      'A hard 503, so the caller owns the retry',
    ],
    recommendedAnswer: 'A hard 503, so the caller owns the retry',
    selectMode: 'one',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-09-04T13:40:00.000Z' as IsoDateTime,
  },
  {
    id: 'mock-lens-question-retryable-set' as OpenQuestionId,
    sessionId: SESSION_ID,
    text: 'Which delivery failures count as retryable?',
    suggestedAnswers: [
      'Connection resets',
      'HTTP 429 with a retry hint',
      'HTTP 502 and 503',
      'Read timeouts past 30 seconds',
    ],
    selectMode: 'many',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-09-04T13:52:00.000Z' as IsoDateTime,
  },
  {
    id: 'mock-lens-question-event-id-scope' as OpenQuestionId,
    sessionId: SESSION_ID,
    text: 'Is the event id unique per tenant or across the whole table?',
    suggestedAnswers: ['Per tenant', 'Across the whole table'],
    selectMode: 'one',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-09-04T14:06:00.000Z' as IsoDateTime,
  },
];

const PLAN_BODY = [
  '## Cap the retry loop',
  '',
  'Six attempts, exponential backoff, and the Retry-After header wins when the',
  'provider sends one.',
  '',
  '## Count the giving up',
  '',
  'Emit retry_backoff_exhausted before the loop returns, so the dashboard shows',
  'it without a log dive.',
].join('\n');

const REPORT_BODY = [
  '## What the retries cost today',
  '',
  'A single stuck delivery spins for hours and eats the rate limit budget every',
  'other tenant depends on.',
  '',
  '## Where the payload leaks',
  '',
  'The debug log prints the whole webhook body, customer email included.',
].join('\n');

const PLAN_ARTIFACT_ID = 'mock-lens-artifact-retry-plan' as ArtifactId;
const REPORT_ARTIFACT_ID = 'mock-lens-artifact-retry-report' as ArtifactId;
const PLAN_ID = 'mock-lens-plan-retry' as PlanId;

const ARTIFACTS: ReadonlyArray<SessionArtifact> = [
  {
    id: PLAN_ARTIFACT_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    workflowRunId: null,
    kind: 'plan',
    schemaVersion: 1,
    title: 'Cap and back off the webhook retries',
    sourceFormat: 'markdown',
    sourceText: PLAN_BODY,
    metadata: {},
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-09-04T12:30:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-04T12:30:00.000Z' as IsoDateTime,
  },
  {
    id: REPORT_ARTIFACT_ID,
    sessionId: SESSION_ID,
    agentId: REPORTER_AGENT_ID,
    workflowRunId: null,
    kind: 'report',
    schemaVersion: 1,
    title: 'Webhook delivery failures, last seven days',
    sourceFormat: 'markdown',
    sourceText: REPORT_BODY,
    metadata: { reportType: 'investigation' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-09-04T11:48:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-04T11:48:00.000Z' as IsoDateTime,
  },
];

const PLANS: ReadonlyArray<PlanWithCount> = [
  {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    title: 'Cap and back off the webhook retries',
    bodyMd: PLAN_BODY,
    status: 'active',
    createdAt: '2026-09-04T12:30:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-04T12:30:00.000Z' as IsoDateTime,
    consumptionCount: 0,
  },
];

const REPLAY_SCRIPT_ID = 'mock-lens-script-replay-dead-letters' as ProjectScriptId;

type UserScriptSeed = Readonly<{
  id: ProjectScriptId;
  name: string;
  body: string;
  sortOrder: number;
}>;

const makeUserScript = ({ id, name, body, sortOrder }: UserScriptSeed): ProjectScript => ({
  id,
  projectId: PROJECT_ID,
  name,
  body,
  sortOrder,
  createdAt: EARLIER,
  updatedAt: NOW,
});

const USER_SCRIPTS: ReadonlyArray<ProjectScript> = [
  makeUserScript({
    id: REPLAY_SCRIPT_ID,
    name: 'Replay dead letters',
    sortOrder: 0,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm exec node ./tools/dead-letters.mjs --since 24h --replay',
    ].join('\n'),
  }),
  makeUserScript({
    id: 'mock-lens-script-webhook-probe' as ProjectScriptId,
    name: 'Probe the webhook endpoint',
    sortOrder: 1,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm exec node ./tools/probe.mjs --endpoint sandbox --attempts 8',
    ].join('\n'),
  }),
  makeUserScript({
    id: 'mock-lens-script-seed-deliveries' as ProjectScriptId,
    name: 'Seed sandbox deliveries',
    sortOrder: 2,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm db:reset && pnpm db:seed -- --deliveries 5000',
    ].join('\n'),
  }),
];

const BILLING_GROUP: ScriptGroup = {
  source: 'package-json',
  packageName: 'billing-api',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    { name: 'dev', command: 'tsx watch src/server.ts' },
    { name: 'test', command: 'vitest run' },
    { name: 'typecheck', command: 'tsc --noEmit' },
    { name: 'deploy:staging', command: 'node ./tools/deploy.mjs --env staging' },
  ],
};

const REPLAY_OUTPUT = [
  '> billing-api@4.2.0 dead-letters',
  '> node ./tools/dead-letters.mjs --since 24h --replay',
  '',
  ' replayed 214 deliveries, 3 still failing',
  ' Error: delivery wh_9f21c8 exhausted 6 attempts without a Retry-After header',
].join('\n');

const SCRIPT_RUNS: Readonly<Record<string, ScriptRunRecord>> = {
  [REPLAY_SCRIPT_ID]: {
    status: 'error',
    result: { stdout: REPLAY_OUTPUT, stderr: '', exitCode: 1 },
    runId: 'mock-lens-run-replay-dead-letters',
    startedAt: Date.parse('2026-09-04T14:02:00.000Z'),
    name: 'Replay dead letters',
  },
};

const READY_SCAN: DiscoveredScriptScan = { status: 'ready', error: null };

const REVIEW_DRAFTS: ReadonlyArray<PrReviewDraft> = [
  {
    id: 'mock-lens-draft-backoff-cap',
    sessionId: SESSION_ID,
    provider: 'github',
    repo: REPO,
    prNumber: PR_NUMBER,
    path: 'src/webhooks/retryPolicy.ts',
    line: 47,
    startLine: null,
    side: 'new',
    body: 'The cap reads from a constant here but the config already carries a per tenant ceiling.',
    status: 'draft',
    stale: false,
    origin: 'agent',
    createdAt: NOW,
  },
];

const SIBLINGS = [
  {
    ...SESSION,
    id: 'mock-lens-session-idempotency' as SessionId,
    goal: 'Add a unique constraint on webhook event ids',
    state: { kind: 'idle', lastActivityAt: '2026-09-04T13:58:00.000Z' as IsoDateTime },
    updatedAt: '2026-09-04T13:58:00.000Z' as IsoDateTime,
  },
  {
    ...SESSION,
    id: 'mock-lens-session-delivery-worker' as SessionId,
    goal: 'Split the delivery worker out of the billing scheduler',
    state: { kind: 'ended', endedAt: EARLIER },
    updatedAt: EARLIER,
  },
] satisfies ReadonlyArray<Session>;

const seedLensSwitcherScene = (): void => {
  seedResolveScene({ expandedThreadId: null });
  seedShellChrome({
    session: SESSION,
    siblings: SIBLINGS,
    branches: {
      [SESSION_ID]: BRANCH,
      'mock-lens-session-idempotency': 'fix/webhook-event-id-unique',
      'mock-lens-session-delivery-worker': 'refactor/delivery-worker-split',
    },
    telemetryAt: NOW,
    lens: 'review',
  });
  const pr = useAppStore.getState().sessionGithub[SESSION_ID]?.pr ?? null;
  useAppStore.setState({
    projects: [PROJECT],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionWorktrees: { [SESSION_ID]: [WORKTREE] },
    sessionProjectPrs: { [SESSION_ID]: { [PROJECT_ID]: pr === null ? [] : [pr] } },
    sessionSelectedPrNumber: { [SESSION_ID]: PR_NUMBER },
    reviewDrafts: { [SESSION_ID]: REVIEW_DRAFTS },
    reviewTargets: { [SESSION_ID]: null },
    diffComments: { [SESSION_ID]: [] },
    activePublicationPreview: { [SESSION_ID]: null },
    sessionOpenQuestions: { [SESSION_ID]: OPEN_QUESTIONS },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    sessionDismissedQuestions: { [SESSION_ID]: [] },
    sessionArtifacts: { [SESSION_ID]: ARTIFACTS },
    sessionPlans: { [SESSION_ID]: PLANS },
    focusedPlanId: { [SESSION_ID]: null },
    focusedArtifactId: { [SESSION_ID]: null },
    projectScripts: { [WORKSPACE_ID]: USER_SCRIPTS },
    scriptRuns: { [SESSION_ID]: SCRIPT_RUNS },
    discoveredScripts: { [SESSION_ID]: { [WORKTREE]: [BILLING_GROUP] } },
    discoveredScriptScans: { [SESSION_ID]: { [WORKTREE]: READY_SCAN } },
    loadReviewDrafts: async () => undefined,
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    loadScripts: async () => undefined,
    loadDiscoveredScripts: async () => undefined,
  });
};

type SceneParams = Readonly<{
  isMenuOpen: boolean;
}>;

const useOpenDestinationMenu = ({ isMenuOpen }: SceneParams): void => {
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const interval = window.setInterval(() => {
      const trigger = window.document.querySelector<HTMLButtonElement>(
        'nav[aria-label="Breadcrumb"] button[aria-haspopup="menu"]',
      );
      if (trigger === null) {
        return;
      }
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        trigger.click();
      }
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isMenuOpen]);
};

type SceneProps = {
  readonly isMenuOpen: boolean;
};

const LensSwitcher = ({ isMenuOpen }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedLensSwitcherScene();
    setIsReady(true);
  }, []);

  useOpenDestinationMenu({ isMenuOpen: isReady && isMenuOpen });

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={<ReviewPane session={SESSION} />} />;
};

export const LensSwitcherScene = () => <LensSwitcher isMenuOpen />;

export const LensSwitcherClosedScene = () => <LensSwitcher isMenuOpen={false} />;
