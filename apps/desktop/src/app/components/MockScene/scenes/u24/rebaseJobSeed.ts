import type { AgentId, MountId } from '@goodboy/types';
import type { HistoryRun, HistoryStop } from '../../../../../store/slices/history/types';
import { sceneClock } from '../../sceneClock';

export const REBASE_JOB_SCENE_STATES = [
  'checking',
  'replaying',
  'merging',
  'checking-result',
  'moving',
  'updating-online',
  'done',
  'stuck',
  'origin-moved',
  'head-moved',
  'push-failed',
  'no-provider',
  'dirty',
  'result-differs',
  'failed',
] as const;

export type RebaseJobSceneState = (typeof REBASE_JOB_SCENE_STATES)[number];

export const REBASE_JOB_MOUNT_ID: MountId = JSON.parse(
  JSON.stringify('mock-u21-mount-fix-duplicate-credit'),
);

export const REBASE_JOB_AGENT_ID: AgentId = JSON.parse(
  JSON.stringify('mock-u24-agent-history-rewriter'),
);

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const HOOK_OUTPUT =
  '$ pnpm lint\nsrc/ledger/postCredit.ts  14:7  error  seenEvents is assigned a value but never used\n1 problem (1 error, 0 warnings)';

const stopOf = (patch: Partial<HistoryStop>): HistoryStop => ({
  reason: 'failed',
  message: '',
  files: [],
  sha: null,
  ...patch,
});

type Patch = Partial<Omit<HistoryRun, 'sessionId' | 'mountId' | 'origin' | 'updatedAt'>>;

const PATCHES: Readonly<Record<RebaseJobSceneState, Patch>> = {
  checking: { phase: 'predicting' },
  replaying: {
    phase: 'trying',
    commitCount: 7,
    progress: { stage: 'step', index: 3, total: 7, sha: 'c9a2f5e81b7d' },
  },
  merging: {
    phase: 'rewriting',
    commitCount: 7,
    agentId: REBASE_JOB_AGENT_ID,
    stop: stopOf({ reason: 'conflict', files: ['webhook.ts'] }),
  },
  'checking-result': {
    phase: 'rewriting',
    commitCount: 7,
    agentId: REBASE_JOB_AGENT_ID,
    progress: { stage: 'check' },
  },
  moving: { phase: 'applying', commitCount: 7 },
  'updating-online': {
    phase: 'pushing',
    commitCount: 7,
    backupRef: 'refs/goodboy/backup/hl-fix-duplicate-credit/1',
  },
  done: {
    phase: 'pushed',
    commitCount: 7,
    agentId: REBASE_JOB_AGENT_ID,
    backupRef: 'refs/goodboy/backup/hl-fix-duplicate-credit/1',
  },
  stuck: {
    phase: 'stopped',
    commitCount: 7,
    agentId: REBASE_JOB_AGENT_ID,
    stop: stopOf({
      reason: 'stuck',
      message: 'both sides change the retry key',
      files: ['webhook.ts'],
    }),
  },
  'origin-moved': {
    phase: 'stopped',
    commitCount: 7,
    backupRef: 'refs/goodboy/backup/hl-fix-duplicate-credit/1',
    stop: stopOf({ reason: 'origin-moved', message: 'Origin has new commits since the rewrite.' }),
  },
  'head-moved': {
    phase: 'stopped',
    commitCount: 7,
    stop: stopOf({
      reason: 'head-moved',
      message: 'The branch moved while the plan was prepared.',
    }),
  },
  'push-failed': {
    phase: 'stopped',
    commitCount: 7,
    backupRef: 'refs/goodboy/backup/hl-fix-duplicate-credit/1',
    stop: stopOf({ reason: 'push-failed', message: `pre-push hook declined\n${HOOK_OUTPUT}` }),
  },
  'no-provider': {
    phase: 'stopped',
    commitCount: 7,
    stop: stopOf({
      reason: 'no-provider',
      message: 'No provider is connected to hand the conflict to History rewriter.',
      files: ['webhook.ts'],
    }),
  },
  dirty: {
    phase: 'stopped',
    stop: stopOf({
      reason: 'dirty',
      message: '11 files have changes that are not committed. Commit or stash them first.',
    }),
  },
  'result-differs': {
    phase: 'stopped',
    commitCount: 7,
    stop: stopOf({
      reason: 'unverified',
      message:
        'The rebase on the copy did not match the branch: The result differs from what the plan should make in 1 file: ledger.ts. Nothing was changed.',
      files: ['ledger.ts'],
    }),
  },
  failed: {
    phase: 'stopped',
    stop: stopOf({ reason: 'failed', message: "Couldn't reach origin: connection reset." }),
  },
};

const DIRTY_STATES: ReadonlySet<RebaseJobSceneState> = new Set<RebaseJobSceneState>([
  'dirty',
  'done',
]);

export const isRebaseJobSceneState = (value: string | null): value is RebaseJobSceneState =>
  REBASE_JOB_SCENE_STATES.some((state) => state === value);

export const rebaseJobSceneStateOf = (): RebaseJobSceneState => {
  const value = new URLSearchParams(window.location.search).get('state');
  return isRebaseJobSceneState(value) ? value : 'replaying';
};

export const dirtyCountOfRebaseJobState = ({
  state,
}: {
  readonly state: RebaseJobSceneState;
}): number => (DIRTY_STATES.has(state) ? 11 : 0);

export const rebaseJobRunOf = ({
  state,
  sessionId,
}: {
  readonly state: RebaseJobSceneState;
  readonly sessionId: HistoryRun['sessionId'];
}): HistoryRun => ({
  sessionId,
  mountId: REBASE_JOB_MOUNT_ID,
  origin: 'rebase',
  phase: 'predicting',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: null,
  ...PATCHES[state],
  updatedAt: clock.ms({ at: '2026-10-10T09:12:00.000Z' }),
});
