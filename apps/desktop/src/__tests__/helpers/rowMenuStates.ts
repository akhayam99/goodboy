import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import type { CommitFacts } from '../../features/actions/kinds/commit';
import type { MountFacts } from '../../features/actions/kinds/mountFacts';
import type { PortKindFacts } from '../../features/actions/kinds/port';
import type { WorktreeFacts } from '../../features/actions/kinds/worktree';

const NO_PR = {
  pr: null,
  requestLabel: null,
  requestNumber: null,
  requestProvider: null,
} as const satisfies Partial<MountFacts>;

const BASE_MOUNT: MountFacts = {
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  mountId: brandId<MountId>({ value: 'mount-payments' }),
  projectId: brandId<ProjectId>({ value: 'project-payments' }),
  label: 'hl/fix-duplicate-credit',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: '/work/payments-api',
  keptPath: '/work/payments-api',
  isRepo: true,
  isClosed: false,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: 'open',
  requestLabel: 'PR #318',
  requestNumber: 318,
  requestProvider: 'github',
  createProvider: 'github',
  ahead: 5,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  pinnedRunIds: [],
  pinnedRunLabel: null,
  editors: [{ binary: 'code', label: 'VS Code' }],
};

const mountWith = (overrides: Partial<MountFacts>): MountFacts => ({ ...BASE_MOUNT, ...overrides });

export const MOUNT_ROW_STATES: ReadonlyArray<readonly [string, MountFacts]> = [
  ['PR open, 3 to resolve', mountWith({ comments: 3 })],
  [
    'PR open, 3 to resolve, other mount takes replies',
    mountWith({ comments: 3, canStartTurnsHere: true }),
  ],
  ['No PR, not pushed', mountWith({ ...NO_PR, ahead: 3, unpushed: 3 })],
  ['No PR, pushed', mountWith({ ...NO_PR, ahead: 3 })],
  ['No PR, behind main', mountWith({ ...NO_PR, ahead: 3, behind: 2 })],
  ['Draft PR', mountWith({ pr: 'draft', ahead: 4 })],
  ['PR open, 2 not pushed', mountWith({ ahead: 6, unpushed: 2 })],
  ['Behind main by 4', mountWith({ behind: 4 })],
  ['Behind, 2 uncommitted', mountWith({ behind: 4, dirty: 2 })],
  ['Diverged from origin', mountWith({ unpushed: 1, isDiverged: true })],
  ['Rebase stopped', mountWith({ dirty: 3, isRebasing: true })],
  [
    'Rebase stopped, asking',
    mountWith({ isRebasing: true, rebaseConflict: { isWithAuto: false, count: 2 } }),
  ],
  ['Merged', mountWith({ pr: 'merged', ahead: 0 })],
  [
    'Merged, a pinned run',
    mountWith({
      pr: 'merged',
      ahead: 0,
      pinnedRunIds: [brandId<WorkflowRunId>({ value: 'run-import' })],
      pinnedRunLabel: 'Import',
    }),
  ],
  ['PR closed', mountWith({ pr: 'closed' })],
  ['New branch, no changes', mountWith({ ...NO_PR, ahead: 0, canStartTurnsHere: true })],
  ['Worktree closed, files kept', mountWith({ isClosed: true, worktreePath: null })],
  [
    'Branch gone, restorable',
    mountWith({ isClosed: true, worktreePath: null, isBranchGone: true, canRestoreBranch: true }),
  ],
  [
    'Branch gone, folder kept',
    mountWith({ isClosed: false, isBranchGone: true, ...NO_PR, ahead: 0 }),
  ],
];

export const COMMIT_ROW_STATES: ReadonlyArray<readonly [string, CommitFacts]> = (() => {
  const base: CommitFacts = {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    shortSha: 'b2c3d4e',
    subject: 'Keep trailing-comma rows in the ledger-core importer',
    isFolded: false,
    isRemoved: false,
    canRemove: true,
    canFoldDown: true,
    onRename: () => undefined,
    onFoldDown: () => undefined,
    onSquashDown: () => undefined,
    onToggleRemove: () => undefined,
    onSeparate: () => undefined,
    onMove: () => undefined,
  };
  return [
    ['a standing commit', base],
    ['the last commit, nothing below', { ...base, canFoldDown: false }],
    ['a folded commit', { ...base, isFolded: true }],
    ['a removed commit', { ...base, isRemoved: true }],
    ['a commit without a subject', { ...base, subject: '' }],
  ];
})();

const worktreeWith = (overrides: Partial<WorktreeFacts>): WorktreeFacts => ({
  path: '/work/notify-relay-old',
  isInUse: false,
  isKept: false,
  removeIntent: 'safe',
  onReveal: () => undefined,
  onEditor: () => undefined,
  onKeep: () => undefined,
  onStopKeeping: () => undefined,
  onRemove: () => undefined,
  onLearn: () => undefined,
  ...overrides,
});

export const WORKTREE_ROW_STATES: ReadonlyArray<readonly [string, WorktreeFacts]> = [
  ['removable', worktreeWith({})],
  ['removable with force', worktreeWith({ removeIntent: 'force' })],
  ['removable, unchecked', worktreeWith({ removeIntent: 'untracked' })],
  ['kept', worktreeWith({ isKept: true })],
  ['in use', worktreeWith({ isInUse: true, removeIntent: null })],
];

const portWith = (overrides: Partial<PortKindFacts>): PortKindFacts => ({
  port: 4001,
  layer: 'goodboy',
  description: '',
  holder: { pid: 6200, name: 'node', spawnId: null, owner: 'Terminal · payments-api' },
  stopProgress: null,
  ...overrides,
});

export const PORT_ROW_STATES: ReadonlyArray<readonly [string, PortKindFacts]> = [
  ['listening', portWith({})],
  ['listening, did not stop', portWith({ stopProgress: 'still-running' })],
  ['pinned', portWith({ layer: 'pinned', description: 'Payments API' })],
  ['pinned, free', portWith({ layer: 'pinned', description: 'Payments API', holder: undefined })],
  ['free', portWith({ holder: undefined })],
];
