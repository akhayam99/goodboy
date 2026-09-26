import { useEffect, useState } from 'react';
import type {
  MountId,
  PrReviewDraft,
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  PullRequestState,
  ResolvePublicationPreview,
  Session,
  SessionId,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { ToastProvider } from '../../Toast';
import { ScriptsPanel } from '../../../../features/scripts/components/ScriptsPanel';
import { ReviewPane } from '../../../../features/review/components/ReviewPane';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import type { ScriptGroup, ScriptRunRecord } from '../../../../features/scripts/scripts';
import { discoveredScriptId } from '../../../../features/scripts/scripts';
import { useAppStore } from '../../../../store';
import type { DiscoveredScriptScan } from '../../../../store/slices/scripts/state';
import { ShellFrame, seedShellChrome } from './shellChrome';
import {
  SESSION as ARTIFACT_SESSION,
  SESSION_ID as ARTIFACT_SESSION_ID,
  seedArtifactScene,
} from './artifactSeed';
import {
  SESSION as RESOLVE_SESSION,
  SESSION_ID as RESOLVE_SESSION_ID,
  seedResolveScene,
} from './resolveSeed';
import { sceneClock } from '../sceneClock';

const scriptsClock = sceneClock({ anchor: '2026-09-16T11:24:00.000Z' });
const reviewClock = sceneClock({ anchor: '2026-09-04T14:20:00.000Z' });
const artifactClock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const noop = () => undefined;

const STUB_RUN_RESULT = { stdout: '', stderr: '', exitCode: 0 };

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
};

const SCRIPTS_WORKSPACE_ID = 'mock-scripts-workspace-harborline' as WorkspaceId;
const SCRIPTS_SESSION_ID = 'mock-scripts-session-settlement' as SessionId;
const LEDGER_PROJECT_ID = 'mock-scripts-project-ledger-core' as ProjectId;
const RELAY_PROJECT_ID = 'mock-scripts-project-notify-relay' as ProjectId;
const PAYMENTS_PROJECT_ID = 'mock-scripts-project-payments-api' as ProjectId;
const NORTHWIND_PROJECT_ID = 'mock-scripts-project-northwind-storefront' as ProjectId;
const LEDGER_MOUNT_ID = 'mock-scripts-mount-ledger' as MountId;

const SCRIPTS_NOW = scriptsClock.iso({ at: '2026-09-16T11:24:00.000Z' });
const SCRIPTS_EARLIER = scriptsClock.iso({ at: '2026-09-16T09:05:00.000Z' });

const LEDGER_WORKTREE = '/mock/harborline/ledger-core-settlement';
const RELAY_WORKTREE = '/mock/harborline/notify-relay-settlement';
const PAYMENTS_WORKTREE = '/mock/harborline/payments-api-settlement';
const NORTHWIND_WORKTREE = '/mock/northwind/storefront-settlement';

const SCRIPTS_WORKSPACE: Workspace = {
  id: SCRIPTS_WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: SCRIPTS_EARLIER,
  updatedAt: SCRIPTS_NOW,
};

type ProjectSeed = Readonly<{
  id: ProjectId;
  name: string;
  rootPath: string;
}>;

const makeProject = ({ id, name, rootPath }: ProjectSeed): Project => ({
  id,
  workspaceId: SCRIPTS_WORKSPACE_ID,
  name,
  rootPath,
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: SCRIPTS_EARLIER,
  updatedAt: SCRIPTS_NOW,
});

const SCRIPTS_PROJECTS: ReadonlyArray<Project> = [
  makeProject({
    id: LEDGER_PROJECT_ID,
    name: 'ledger-core',
    rootPath: '/mock/harborline/ledger-core',
  }),
  makeProject({
    id: RELAY_PROJECT_ID,
    name: 'notify-relay',
    rootPath: '/mock/harborline/notify-relay',
  }),
  makeProject({
    id: PAYMENTS_PROJECT_ID,
    name: 'payments-api',
    rootPath: '/mock/harborline/payments-api',
  }),
  makeProject({
    id: NORTHWIND_PROJECT_ID,
    name: 'northwind-storefront',
    rootPath: '/mock/northwind/storefront',
  }),
];

type MountSeed = Readonly<{
  mountId: string;
  projectId: ProjectId;
  mountName: string;
  worktreePath: string;
  repoRoot: string;
  branch: string;
  parallelIndex: number;
}>;

const makeScriptsMount = ({
  mountId,
  projectId,
  mountName,
  worktreePath,
  repoRoot,
  branch,
  parallelIndex,
}: MountSeed): SessionProjectMount => ({
  mountId: mountId as MountId,
  sessionId: SCRIPTS_SESSION_ID,
  projectId,
  mountName,
  worktreePath,
  lastWorktreePath: null,
  repoRoot,
  branch,
  baseBranch: 'main',
  parallelIndex,
  isAttached: true,
  diskState: 'present',
  revision: 2,
});

const SCRIPTS_MOUNTS: ReadonlyArray<SessionProjectMount> = [
  makeScriptsMount({
    mountId: 'mock-scripts-mount-northwind',
    projectId: NORTHWIND_PROJECT_ID,
    mountName: 'northwind-storefront',
    worktreePath: NORTHWIND_WORKTREE,
    repoRoot: '/mock/northwind/storefront',
    branch: 'nw/fix-settlement-replay',
    parallelIndex: 3,
  }),
  makeScriptsMount({
    mountId: LEDGER_MOUNT_ID,
    projectId: LEDGER_PROJECT_ID,
    mountName: 'ledger-core',
    worktreePath: LEDGER_WORKTREE,
    repoRoot: '/mock/harborline/ledger-core',
    branch: 'nw/fix-settlement-replay',
    parallelIndex: 0,
  }),
  makeScriptsMount({
    mountId: 'mock-scripts-mount-relay',
    projectId: RELAY_PROJECT_ID,
    mountName: 'notify-relay',
    worktreePath: RELAY_WORKTREE,
    repoRoot: '/mock/harborline/notify-relay',
    branch: 'nw/fix-settlement-replay',
    parallelIndex: 1,
  }),
  makeScriptsMount({
    mountId: 'mock-scripts-mount-payments',
    projectId: PAYMENTS_PROJECT_ID,
    mountName: 'payments-api',
    worktreePath: PAYMENTS_WORKTREE,
    repoRoot: '/mock/harborline/payments-api',
    branch: 'nw/fix-settlement-replay',
    parallelIndex: 2,
  }),
];

const SCRIPTS_SESSION: Session = {
  id: SCRIPTS_SESSION_ID,
  workspaceId: SCRIPTS_WORKSPACE_ID,
  goal: 'Replay the stuck settlement batch and stop notify-relay from double sending receipts',
  state: { kind: 'idle', lastActivityAt: SCRIPTS_NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: LEDGER_PROJECT_ID,
  createdAt: SCRIPTS_EARLIER,
  updatedAt: SCRIPTS_NOW,
};

const RUNNING_SCRIPT_ID = 'mock-scripts-script-settlement-replay' as ProjectScriptId;
const DRIFT_SCRIPT_ID = 'mock-scripts-script-posting-drift' as ProjectScriptId;

type UserScriptSeed = Readonly<{
  id: string;
  projectId: ProjectId;
  name: string;
  body: string;
  sortOrder: number;
}>;

const makeUserScript = ({
  id,
  projectId,
  name,
  body,
  sortOrder,
}: UserScriptSeed): ProjectScript => ({
  id: id as ProjectScriptId,
  projectId,
  name,
  body,
  sortOrder,
  createdAt: SCRIPTS_EARLIER,
  updatedAt: SCRIPTS_NOW,
});

const USER_SCRIPTS: ReadonlyArray<ProjectScript> = [
  makeUserScript({
    id: RUNNING_SCRIPT_ID,
    projectId: LEDGER_PROJECT_ID,
    name: 'Replay settlement batch',
    sortOrder: 0,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'BATCH=${1:-2026-09-15}',
      'pnpm --filter ledger-core exec node ./tools/replay.mjs --batch "$BATCH" --dry-run=false',
      'pnpm --filter ledger-core exec node ./tools/verify-postings.mjs --batch "$BATCH"',
    ].join('\n'),
  }),
  makeUserScript({
    id: DRIFT_SCRIPT_ID,
    projectId: LEDGER_PROJECT_ID,
    name: 'Check posting drift',
    sortOrder: 1,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm --filter ledger-core exec vitest run postings/rounding --reporter=dot',
    ].join('\n'),
  }),
  makeUserScript({
    id: 'mock-scripts-script-seed-sandbox',
    projectId: LEDGER_PROJECT_ID,
    name: 'Seed sandbox ledger',
    sortOrder: 2,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm --filter ledger-core db:reset',
      'pnpm --filter ledger-core db:seed -- --accounts 400 --postings 25000',
    ].join('\n'),
  }),
  makeUserScript({
    id: 'mock-scripts-script-rotate-keys',
    projectId: LEDGER_PROJECT_ID,
    name: 'Rotate webhook signing keys',
    sortOrder: 3,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm --filter ledger-core exec node ./tools/rotate-signing-keys.mjs --env sandbox',
    ].join('\n'),
  }),
  makeUserScript({
    id: 'mock-scripts-script-replay-dead-letters',
    projectId: RELAY_PROJECT_ID,
    name: 'Replay dead letters',
    sortOrder: 4,
    body: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'pnpm --filter notify-relay exec node ./tools/dead-letters.mjs --since 24h --replay',
    ].join('\n'),
  }),
];

const LEDGER_ROOT_GROUP: ScriptGroup = {
  source: 'package-json',
  packageName: 'ledger-core',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    { name: 'dev', command: 'vite --host --port 4310' },
    { name: 'build', command: 'tsc -b && vite build' },
    { name: 'test', command: 'vitest run' },
    { name: 'test:watch', command: 'vitest --ui' },
    { name: 'typecheck', command: 'tsc --noEmit' },
    { name: 'lint', command: 'biome check .' },
    { name: 'format', command: 'prettier --write .' },
    { name: 'db:migrate', command: 'node ./tools/migrate.mjs --to latest' },
    { name: 'db:seed', command: 'node ./tools/seed.mjs --accounts 400' },
    { name: 'codegen', command: 'openapi-typescript ./openapi.yaml -o ./src/api/schema.ts' },
    { name: 'clean', command: 'rm -rf dist .turbo node_modules/.cache' },
    { name: 'docs', command: 'typedoc --out docs/api src/index.ts' },
  ],
};

const POSTINGS_GROUP: ScriptGroup = {
  source: 'package-json',
  packageName: '@harborline/postings',
  relDir: 'packages/postings',
  manager: 'pnpm',
  scripts: [
    { name: 'build', command: 'tsup src/index.ts --dts' },
    { name: 'test', command: 'vitest run --coverage' },
    { name: 'typecheck', command: 'tsc --noEmit' },
    { name: 'bench', command: 'node ./bench/rounding.mjs --iterations 50000' },
  ],
};

const RELAY_GROUP: ScriptGroup = {
  source: 'package-json',
  packageName: 'notify-relay',
  relDir: '',
  manager: 'pnpm',
  scripts: [
    { name: 'dev', command: 'tsx watch src/server.ts' },
    { name: 'test', command: 'vitest run' },
    { name: 'typecheck', command: 'tsc --noEmit' },
    { name: 'deploy:staging', command: 'node ./tools/deploy.mjs --env staging' },
  ],
};

const PAYMENTS_GROUP: ScriptGroup = {
  source: 'composer',
  packageName: 'harborline/payments-api',
  relDir: '',
  manager: 'composer',
  scripts: [
    { name: 'test', command: 'vendor/bin/phpunit --testsuite unit' },
    { name: 'lint', command: 'vendor/bin/php-cs-fixer fix --dry-run' },
    { name: 'migrate', command: 'php artisan migrate --force' },
  ],
};

type NorthwindPackageSeed = Readonly<{
  packageName: string;
  relDir: string;
  names: ReadonlyArray<string>;
}>;

const makeNorthwindGroup = ({ packageName, relDir, names }: NorthwindPackageSeed): ScriptGroup => ({
  source: 'package-json',
  packageName,
  relDir,
  manager: 'yarn',
  scripts: names.map((name) => ({ name, command: `yarn run ${name}` })),
});

const NORTHWIND_GROUPS: ReadonlyArray<ScriptGroup> = [
  makeNorthwindGroup({
    packageName: 'northwind-storefront',
    relDir: '',
    names: ['dev', 'build', 'lint'],
  }),
  makeNorthwindGroup({
    packageName: '@northwind/api',
    relDir: 'apps/api',
    names: ['dev', 'test', 'db:migrate'],
  }),
  makeNorthwindGroup({
    packageName: '@northwind/web',
    relDir: 'apps/web',
    names: ['dev', 'build', 'test'],
  }),
  makeNorthwindGroup({
    packageName: '@acme/ui',
    relDir: 'packages/ui',
    names: ['dev', 'build', 'storybook'],
  }),
];

const DRIFT_OUTPUT = [
  '> ledger-core@2.14.0 test',
  '> vitest run postings/rounding --reporter=dot',
  '',
  ' ❯ src/postings/rounding.test.ts (18 tests | 2 failed) 1284ms',
  '',
  ' FAIL  src/postings/rounding.test.ts > splits a half cent toward the debit leg',
  ' AssertionError: expected 1250.49 to be 1250.50',
  '  - Expected  1250.50',
  '  + Received  1250.49',
  '      at src/postings/rounding.test.ts:118:24',
  '',
  ' FAIL  src/postings/rounding.test.ts > keeps the batch total stable across 10k postings',
  ' AssertionError: expected 88214.37 to be 88214.40',
  '      at src/postings/rounding.test.ts:203:18',
  '',
  ' Test Files  1 failed (1)',
  '      Tests  2 failed | 16 passed (18)',
  '   Duration  2.41s',
].join('\n');

const LEDGER_TEST_SCRIPT_ID = discoveredScriptId({
  worktreePath: LEDGER_WORKTREE,
  source: LEDGER_ROOT_GROUP.source,
  relDir: LEDGER_ROOT_GROUP.relDir,
  name: 'test',
});

const LEDGER_DEV_SCRIPT_ID = discoveredScriptId({
  worktreePath: LEDGER_WORKTREE,
  source: LEDGER_ROOT_GROUP.source,
  relDir: LEDGER_ROOT_GROUP.relDir,
  name: 'dev',
});

const SCRIPT_RUNS: Readonly<Record<string, ScriptRunRecord>> = {
  [RUNNING_SCRIPT_ID]: {
    status: 'pending',
    result: null,
    runId: 'mock-scripts-run-settlement-replay',
    startedAt: scriptsClock.ms({ at: '2026-09-16T11:22:40.000Z' }),
    name: 'Replay settlement batch',
  },
  [DRIFT_SCRIPT_ID]: {
    status: 'error',
    result: { stdout: DRIFT_OUTPUT, stderr: '', exitCode: 1 },
    runId: 'mock-scripts-run-posting-drift',
    startedAt: scriptsClock.ms({ at: '2026-09-16T11:06:12.000Z' }),
    completedAt: scriptsClock.ms({ at: '2026-09-16T11:06:24.000Z' }),
    name: 'Check posting drift',
  },
  [LEDGER_TEST_SCRIPT_ID]: {
    status: 'ok',
    result: {
      stdout: [
        '> ledger-core@2.14.0 test',
        '> vitest run',
        '',
        ' Test Files  62 passed (62)',
        '      Tests  914 passed (914)',
        '   Duration  41.82s',
      ].join('\n'),
      stderr: '',
      exitCode: 0,
    },
    runId: 'mock-scripts-run-ledger-test',
    startedAt: scriptsClock.ms({ at: '2026-09-16T10:41:03.000Z' }),
    completedAt: scriptsClock.ms({ at: '2026-09-16T10:41:45.000Z' }),
    name: 'test',
  },
  [LEDGER_DEV_SCRIPT_ID]: {
    status: 'pending',
    result: null,
    runId: 'mock-scripts-run-ledger-dev',
    startedAt: scriptsClock.ms({ at: '2026-09-16T09:12:00.000Z' }),
    name: 'dev',
  },
};

const READY_SCAN: DiscoveredScriptScan = { status: 'ready', error: null };

const seedScriptsScene = (): void => {
  useAppStore.setState({
    workspaces: [SCRIPTS_WORKSPACE],
    currentWorkspaceId: SCRIPTS_WORKSPACE_ID,
    projects: SCRIPTS_PROJECTS,
    sessions: [SCRIPTS_SESSION],
    currentSessionId: SCRIPTS_SESSION_ID,
    sessionProjectMounts: { [SCRIPTS_SESSION_ID]: SCRIPTS_MOUNTS },
    sessionActiveMount: { [SCRIPTS_SESSION_ID]: LEDGER_MOUNT_ID },
    sessionActiveProject: { [SCRIPTS_SESSION_ID]: LEDGER_PROJECT_ID },
    projectScripts: { [SCRIPTS_WORKSPACE_ID]: USER_SCRIPTS },
    scriptRuns: { [SCRIPTS_SESSION_ID]: SCRIPT_RUNS },
    discoveredScripts: {
      [SCRIPTS_SESSION_ID]: {
        [LEDGER_WORKTREE]: [LEDGER_ROOT_GROUP, POSTINGS_GROUP],
        [RELAY_WORKTREE]: [RELAY_GROUP],
        [PAYMENTS_WORKTREE]: [PAYMENTS_GROUP],
        [NORTHWIND_WORKTREE]: NORTHWIND_GROUPS,
      },
    },
    discoveredScriptScans: {
      [SCRIPTS_SESSION_ID]: {
        [NORTHWIND_WORKTREE]: READY_SCAN,
        [LEDGER_WORKTREE]: READY_SCAN,
        [RELAY_WORKTREE]: READY_SCAN,
        [PAYMENTS_WORKTREE]: READY_SCAN,
      },
    },
    scriptsLensScope: null,
    loadScripts: async () => undefined,
    saveScript: async () => undefined,
    deleteScript: async () => undefined,
    runScript: async () => STUB_RUN_RESULT,
    cancelScript: async () => undefined,
    loadDiscoveredScripts: async () => undefined,
    refreshDiscoveredScripts: async () => undefined,
    runDiscoveredScript: async () => STUB_RUN_RESULT,
    setScriptsLensScope: noop,
    setActiveLens: noop,
  });
};

export const ScriptsLensScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedScriptsScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background p-4 text-foreground">
        <ScriptsPanel workspaceId={SCRIPTS_WORKSPACE_ID} sessionId={SCRIPTS_SESSION_ID} />
      </main>
    </ToastProvider>
  );
};

const BILLING_PROJECT_ID = 'mock-resolve-project-billing-api' as ProjectId;
const BILLING_MOUNT_ID = 'mock-resolve-mount-billing-api' as MountId;
const REVIEW_NOW = reviewClock.iso({ at: '2026-09-04T14:20:00.000Z' });
const REVIEW_WORKTREE = '/mock/cascadia/billing-api-webhook-retry';
const REVIEW_PR_NUMBER = 528;
const REVIEW_BRANCH = 'fix/webhook-retry-backoff';
const REVIEW_REPO = 'cascadia/billing-api';

const THREAD_RETRY_BACKOFF_ID = 'PRRT_thread_retry_backoff';
const THREAD_RETRY_METRICS_ID = 'PRRT_thread_retry_metrics';
const THREAD_ERROR_SHAPE_ID = 'PRRT_thread_error_shape';
const THREAD_IDEMPOTENCY_ID = 'PRRT_thread_idempotency';
const THREAD_LOG_REDACT_ID = 'PRRT_thread_log_redact';

const BILLING_PROJECT: Project = {
  id: BILLING_PROJECT_ID,
  workspaceId: RESOLVE_SESSION.workspaceId,
  name: 'billing-api',
  rootPath: '/mock/cascadia/billing-api',
  kind: 'repo',
  baseBranch: 'main',
  overrides: OVERRIDES,
  createdAt: REVIEW_NOW,
  updatedAt: REVIEW_NOW,
};

const BILLING_MOUNT: SessionProjectMount = {
  mountId: BILLING_MOUNT_ID,
  sessionId: RESOLVE_SESSION_ID,
  projectId: BILLING_PROJECT_ID,
  mountName: 'billing-api',
  worktreePath: REVIEW_WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/mock/cascadia/billing-api',
  branch: REVIEW_BRANCH,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 3,
};

const SECOND_PR: PullRequestState = {
  number: 531,
  title: 'Split the delivery worker out of the billing scheduler',
  url: 'https://example.invalid/cascadia/billing-api/pull/531',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'refactor/delivery-worker-split',
  isDraft: true,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: REVIEW_NOW,
};

type DraftSeed = Readonly<{
  id: string;
  path: string;
  line: number;
  body: string;
}>;

const makeDraft = ({ id, path, line, body }: DraftSeed): PrReviewDraft => ({
  id,
  sessionId: RESOLVE_SESSION_ID,
  provider: 'github',
  repo: REVIEW_REPO,
  prNumber: REVIEW_PR_NUMBER,
  path,
  line,
  startLine: null,
  side: 'new',
  body,
  status: 'draft',
  stale: false,
  origin: 'agent',
  createdAt: REVIEW_NOW,
});

const REVIEW_DRAFTS: ReadonlyArray<PrReviewDraft> = [
  makeDraft({
    id: 'mock-surface-draft-backoff-cap',
    path: 'src/webhooks/retryPolicy.ts',
    line: 47,
    body: 'The cap reads from a constant here but the config already carries a per tenant ceiling. Prefer the config value so a noisy tenant can be tightened without a deploy.',
  }),
  makeDraft({
    id: 'mock-surface-draft-metric-name',
    path: 'src/webhooks/metrics.ts',
    line: 22,
    body: 'Name this retry_backoff_exhausted_total so the counter matches the rest of the dashboard.',
  }),
];

const PREVIEW_COMMITS = [
  {
    sha: 'e37b92c05a1f8d4e6b27c90a3f5d81e402b7c96a',
    shortSha: 'e37b92c',
    subject: 'Cap webhook retries and honor Retry-After',
    author: 'a-delgado',
    timestamp: reviewClock.ms({ at: '2026-09-04T13:28:00.000Z' }),
    pushed: false,
    parentSha: 'c81f4a20d95e73b6f10c8a4d29e75b3f60c19d84',
    threadIds: [THREAD_RETRY_BACKOFF_ID, THREAD_RETRY_METRICS_ID],
  },
  {
    sha: '4f21c8b9a7d3e6015482ba9c7d3e6f0158249bcd',
    shortSha: '4f21c8b',
    subject: 'Redact webhook payloads before logging',
    author: 'kwatanabe',
    timestamp: reviewClock.ms({ at: '2026-09-04T12:11:00.000Z' }),
    pushed: false,
    parentSha: 'e37b92c05a1f8d4e6b27c90a3f5d81e402b7c96a',
    threadIds: [THREAD_LOG_REDACT_ID],
  },
];

const PREVIEW_REPLIES = [
  {
    threadId: THREAD_RETRY_BACKOFF_ID,
    revision: 1,
    closes: true,
    body: 'Capped the loop at 6 attempts with exponential backoff, and the Retry-After header now wins when the provider sends one.',
  },
  {
    threadId: THREAD_RETRY_METRICS_ID,
    revision: 1,
    closes: true,
    body: 'The loop emits retry_backoff_exhausted before it gives up, so the dashboard shows it without a log dive.',
  },
  {
    threadId: THREAD_LOG_REDACT_ID,
    revision: 1,
    closes: true,
    body: 'Only the event id and the status code are logged now; the payload never reaches the logger.',
  },
];

const PREVIEW_EXCLUDED = [
  { threadId: THREAD_ERROR_SHAPE_ID, reason: 'needs_you' },
  { threadId: THREAD_IDEMPOTENCY_ID, reason: 'working' },
] satisfies ResolvePublicationPreview['excluded'];

const PUBLISH_PREVIEW: ResolvePublicationPreview = {
  publicationId: 'mock-surface-publication-webhook-retry',
  repo: REVIEW_REPO,
  prNumber: REVIEW_PR_NUMBER,
  branch: REVIEW_BRANCH,
  localHead: '4f21c8b9a7d3e6015482ba9c7d3e6f0158249bcd',
  remoteHead: 'c81f4a20d95e73b6f10c8a4d29e75b3f60c19d84',
  requiresPush: true,
  frozenAt: reviewClock.ms({ at: '2026-09-04T14:12:00.000Z' }),
  commits: PREVIEW_COMMITS,
  unapproved: [],
  replies: PREVIEW_REPLIES,
  notes: [],
  excluded: PREVIEW_EXCLUDED,
  drift: [],
  blocker: null,
};

const BLOCKED_PREVIEW: ResolvePublicationPreview = {
  ...PUBLISH_PREVIEW,
  publicationId: null,
  commits: PREVIEW_COMMITS.slice(0, 1),
  replies: PREVIEW_REPLIES.slice(0, 2),
  drift: [
    {
      kind: 'comment_changed',
      threadId: THREAD_LOG_REDACT_ID,
      before: 'revision 1',
      after: 'revision 2',
    },
  ],
  blocker: 'dirty_tree',
};

type ReviewSeedParams = Readonly<{
  preview: ResolvePublicationPreview;
}>;

const REVIEW_SIBLINGS: ReadonlyArray<Session> = [
  {
    ...RESOLVE_SESSION,
    id: 'mock-surface-session-idempotency' as SessionId,
    goal: 'Add a unique constraint on webhook event ids',
    state: { kind: 'idle', lastActivityAt: reviewClock.iso({ at: '2026-09-04T13:58:00.000Z' }) },
    updatedAt: reviewClock.iso({ at: '2026-09-04T13:58:00.000Z' }),
  },
  {
    ...RESOLVE_SESSION,
    id: 'mock-surface-session-invoice-rounding' as SessionId,
    goal: 'Fix the invoice rounding drift reported by finance',
    state: { kind: 'idle', lastActivityAt: reviewClock.iso({ at: '2026-09-04T12:40:00.000Z' }) },
    updatedAt: reviewClock.iso({ at: '2026-09-04T12:40:00.000Z' }),
  },
  {
    ...RESOLVE_SESSION,
    id: 'mock-surface-session-delivery-worker' as SessionId,
    goal: 'Split the delivery worker out of the billing scheduler',
    state: { kind: 'ended', endedAt: reviewClock.iso({ at: '2026-09-04T11:05:00.000Z' }) },
    updatedAt: reviewClock.iso({ at: '2026-09-04T11:05:00.000Z' }),
  },
];

const seedReviewScene = ({ preview }: ReviewSeedParams): void => {
  seedResolveScene({ expandedThreadId: null });
  seedShellChrome({
    session: RESOLVE_SESSION,
    siblings: REVIEW_SIBLINGS,
    branches: {
      [RESOLVE_SESSION_ID]: REVIEW_BRANCH,
      'mock-surface-session-idempotency': 'fix/webhook-event-id-unique',
      'mock-surface-session-invoice-rounding': 'fix/invoice-rounding-drift',
      'mock-surface-session-delivery-worker': 'refactor/delivery-worker-split',
    },
    telemetryAt: REVIEW_NOW,
    lens: 'review',
  });
  useAppStore.setState({
    projects: [BILLING_PROJECT],
    sessionProjectMounts: { [RESOLVE_SESSION_ID]: [BILLING_MOUNT] },
    sessionActiveMount: { [RESOLVE_SESSION_ID]: BILLING_MOUNT_ID },
    sessionActiveProject: { [RESOLVE_SESSION_ID]: BILLING_PROJECT_ID },
    sessionProjectPrs: {
      [RESOLVE_SESSION_ID]: {
        [BILLING_PROJECT_ID]: [
          useAppStore.getState().sessionGithub[RESOLVE_SESSION_ID]?.pr ?? SECOND_PR,
          SECOND_PR,
        ],
      },
    },
    sessionSelectedPrNumber: { [RESOLVE_SESSION_ID]: REVIEW_PR_NUMBER },
    reviewDrafts: { [RESOLVE_SESSION_ID]: REVIEW_DRAFTS },
    reviewTargets: { [RESOLVE_SESSION_ID]: null },
    diffComments: { [RESOLVE_SESSION_ID]: [] },
    activePublicationPreview: { [RESOLVE_SESSION_ID]: preview },
    loadReviewDrafts: async () => undefined,
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    preparePublication: async () => preview,
  });
};

export const ResolveQueueShellScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedReviewScene({ preview: PUBLISH_PREVIEW });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={RESOLVE_SESSION} main={<ReviewPane session={RESOLVE_SESSION} />} />;
};

export const ResolvePublishBlockedScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedReviewScene({ preview: BLOCKED_PREVIEW });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={RESOLVE_SESSION} main={<ReviewPane session={RESOLVE_SESSION} />} />;
};

const ARTIFACT_SIBLINGS: ReadonlyArray<Session> = [
  {
    ...ARTIFACT_SESSION,
    id: 'mock-surface-session-settled-batches' as SessionId,
    goal: 'Stop notify-relay from retrying settled batches',
    state: { kind: 'idle', lastActivityAt: artifactClock.iso({ at: '2026-09-14T16:12:00.000Z' }) },
    updatedAt: artifactClock.iso({ at: '2026-09-14T16:12:00.000Z' }),
  },
  {
    ...ARTIFACT_SESSION,
    id: 'mock-surface-session-payout-export' as SessionId,
    goal: 'Add a monthly payout export for finance',
    state: { kind: 'idle', lastActivityAt: artifactClock.iso({ at: '2026-09-14T15:20:00.000Z' }) },
    updatedAt: artifactClock.iso({ at: '2026-09-14T15:20:00.000Z' }),
  },
  {
    ...ARTIFACT_SESSION,
    id: 'mock-surface-session-webhook-audit' as SessionId,
    goal: 'Audit the webhook signing rotation runbook',
    state: { kind: 'ended', endedAt: artifactClock.iso({ at: '2026-09-14T13:44:00.000Z' }) },
    updatedAt: artifactClock.iso({ at: '2026-09-14T13:44:00.000Z' }),
  },
];

export const ArtifactsLensShellScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: null });
    seedShellChrome({
      session: ARTIFACT_SESSION,
      siblings: ARTIFACT_SIBLINGS,
      branches: {
        [ARTIFACT_SESSION_ID]: 'nw/fix-posting-rounding',
        'mock-surface-session-settled-batches': 'nw/fix-settled-batch-retries',
        'mock-surface-session-payout-export': 'nw/feat-monthly-payout-export',
        'mock-surface-session-webhook-audit': 'nw/chore-webhook-rotation-runbook',
      },
      telemetryAt: artifactClock.iso({ at: '2026-09-14T16:40:00.000Z' }),
      lens: 'plans',
    });
    useAppStore.setState({ artifactFilter: { [ARTIFACT_SESSION_ID]: 'plan' } });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={ARTIFACT_SESSION}
      main={<ArtifactStudio sessionId={ARTIFACT_SESSION_ID} />}
    />
  );
};
