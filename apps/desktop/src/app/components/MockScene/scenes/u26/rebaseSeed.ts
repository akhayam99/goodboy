import type { MountId, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import type { HistoryRun } from '../../../../../store/slices/history/types';
import { SESSION_ID } from '../resolveSeed';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import type {
  RebaseAllBranchState,
  RebaseAllRun,
} from '../../../../../store/slices/rebaseAll/types';

type ConflictRunParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly files: ReadonlyArray<string>;
};

export const conflictRunOf = ({ sessionId, mountId, files }: ConflictRunParams): HistoryRun => ({
  sessionId,
  mountId,
  origin: 'rebase',
  phase: 'stopped',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: { reason: 'conflict', message: '', files, sha: 'c9a2f5e81b7d' },
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: 4,
  rebaseConflict: {
    ontoRef: 'origin/main',
    baseBranch: 'main',
    head: '7f3c1d9a2b4e',
    autoAgentId: null,
  },
  updatedAt: Date.parse('2026-10-17T09:12:00.000Z'),
});

type MountSeed = {
  readonly name: string;
  readonly branch: string;
};

const mountOf = ({ name, branch }: MountSeed): SessionProjectMount => ({
  mountId: brandedId<MountId>({ value: `mock-u26-mount-${name}` }),
  sessionId: SESSION_ID,
  projectId: brandedId<ProjectId>({ value: `mock-u26-project-${name}` }),
  mountName: name,
  worktreePath: `/w/harborline/${name}`,
  lastWorktreePath: null,
  repoRoot: `/w/harborline/${name}`,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

export const REBASE_ALL_MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf({ name: 'ledger-core', branch: 'hl/export-batch' }),
  mountOf({ name: 'notify-relay', branch: 'hl/retry-copy' }),
  mountOf({ name: 'payments-api', branch: 'hl/fix-duplicate-credit' }),
];

type BatchSeed = {
  readonly project: string;
  readonly slug: string;
  readonly state: RebaseAllBranchState;
  readonly autoState: RebaseAllBranchState;
};

const BATCH: ReadonlyArray<BatchSeed> = [
  { project: 'payments-api', slug: 'fix-duplicate-credit', state: 'rebased', autoState: 'rebased' },
  { project: 'payments-api', slug: 'retry-credit-notes', state: 'rebased', autoState: 'rebased' },
  { project: 'payments-api', slug: 'webhook-backoff', state: 'rebasing', autoState: 'auto' },
  { project: 'notify-relay', slug: 'retry-copy', state: 'queued', autoState: 'auto' },
  { project: 'notify-relay', slug: 'delivery-metrics', state: 'conflict', autoState: 'auto' },
  { project: 'ledger-core', slug: 'export-batch', state: 'queued', autoState: 'failed' },
  { project: 'ledger-core', slug: 'posting-dedupe', state: 'queued', autoState: 'rebased' },
];

const batchMountOf = ({ project, slug }: BatchSeed): SessionProjectMount => ({
  ...mountOf({ name: project, branch: `hl/${slug}` }),
  mountId: brandedId<MountId>({ value: `mock-u26-batch-${slug}` }),
  worktreePath: `/w/harborline/${project}-${slug}`,
  parallelIndex: 0,
});

export const REBASE_BATCH_MOUNTS: ReadonlyArray<SessionProjectMount> = BATCH.map(batchMountOf);

export const BATCH_REBASING_MOUNT = REBASE_BATCH_MOUNTS[2];

export const BATCH_CONFLICT_MOUNT = REBASE_BATCH_MOUNTS[4];

type RunParams = {
  readonly isAuto: boolean;
};

export const rebaseAllRunOf = ({ isAuto }: RunParams): RebaseAllRun => ({
  id: 'mock-u26-rebase-all',
  sessionId: SESSION_ID,
  shouldTidy: false,
  isAborted: false,
  phase: isAuto ? 'handed' : 'running',
  autoAgentId: null,
  error: null,
  branches: REBASE_BATCH_MOUNTS.map((mount, index) => {
    const seed = BATCH[index];
    const state = (isAuto ? seed?.autoState : seed?.state) ?? 'queued';
    return {
      mountId: mount.mountId,
      projectName: mount.mountName,
      branch: mount.branch,
      state,
      message: state === 'failed' ? 'Could not fetch main' : null,
    };
  }),
});

type RebasingParams = {
  readonly mountId: MountId;
};

export const rebasingRunOf = ({ mountId }: RebasingParams): HistoryRun => {
  const { rebaseConflict: _dropped, ...run } = conflictRunOf({
    sessionId: SESSION_ID,
    mountId,
    files: [],
  });
  return {
    ...run,
    phase: 'trying',
    stop: null,
    progress: { stage: 'step', index: 2, total: 5, sha: 'b81e4a7c33d0' },
  };
};

export const AUTO_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: {
      models: [],
      supportsTools: true,
      supportsStream: true,
      supportsCheapModel: true,
    },
    connection: 'connected',
    version: '1.0.0',
    identity: 'harborline',
    label: 'Claude',
    error: null,
    docsUrl: 'https://example.invalid/docs',
  },
];
