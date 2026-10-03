import type {
  DeletedBranch,
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  Session,
  SessionId,
} from '@goodboy/types';
import type { GoodboyBranch } from '@goodboy/db';
import type { BranchMergeState } from '../../../../../features/worktree/worktree';
import type { BranchLocation, ProjectBranch } from '../../../../../features/worktree/branchCleanup';
import type { BranchScanEntry } from '../../../../../store/slices/branch-cleanup';
import type { StorageFolder, StorageRoot } from '../../../../../store/slices/storage/types';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { SETTINGS_PROJECTS, SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { BRAND_SESSION } from './canon';
import { seedBrandSettings } from './settingsBrandSeed';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.now();
const USER_EMAIL = 'dana@harborline.dev';

const daysAgoMs = (days: number): number => NOW_MS - days * DAY_MS;

const daysAgoIso = (days: number): IsoDateTime =>
  new Date(daysAgoMs(days)).toISOString() as IsoDateTime;

const PAYMENTS_ID = 'mock-settings-payments' as ProjectId;
const LEDGER_ID = 'mock-settings-ledger' as ProjectId;
const RELAY_ID = 'mock-settings-relay' as ProjectId;

const rootOf = (projectId: ProjectId): string =>
  SETTINGS_PROJECTS.find((project) => project.id === projectId)?.rootPath ?? '';

type BranchSpec = {
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly goal: string;
  readonly days: number;
  readonly mergeState: BranchMergeState;
  readonly location: BranchLocation;
  readonly sha: string;
};

const BRANCHES: ReadonlyArray<BranchSpec> = [
  {
    projectId: PAYMENTS_ID,
    branch: 'hl/idempotency-column',
    goal: 'Add the processor event id column',
    days: 1,
    mergeState: { kind: 'merged-via-pr' },
    location: 'on-origin',
    sha: '8c41e07',
  },
  {
    projectId: LEDGER_ID,
    branch: 'hl/flaky-retry-test',
    goal: 'Fix a flaky retry test in the export pipeline',
    days: 9,
    mergeState: { kind: 'merged-via-merge' },
    location: 'on-origin',
    sha: '2f9a3b1',
  },
  {
    projectId: PAYMENTS_ID,
    branch: 'hl/refund-idempotency-header',
    goal: 'Accept an Idempotency-Key header on refunds',
    days: 9,
    mergeState: { kind: 'no-own-commits' },
    location: 'local-only',
    sha: 'a07d5c2',
  },
  {
    projectId: LEDGER_ID,
    branch: 'hl/reconcile-settlement-export',
    goal: 'Reconcile the settlement export against the ledger snapshot',
    days: 3,
    mergeState: { kind: 'merged-via-merge' },
    location: 'on-origin',
    sha: 'd3e8f10',
  },
  {
    projectId: LEDGER_ID,
    branch: 'hl/retire-export-cron',
    goal: 'Retire the legacy export cron job',
    days: 14,
    mergeState: { kind: 'merged-via-rebase' },
    location: 'gone-on-origin',
    sha: '5b6c9e4',
  },
  {
    projectId: LEDGER_ID,
    branch: 'hl/nightly-reconciliation',
    goal: 'Nightly reconciliation before the Monday close',
    days: 4,
    mergeState: { kind: 'merged-via-merge' },
    location: 'on-origin',
    sha: 'e1f27a8',
  },
  {
    projectId: LEDGER_ID,
    branch: 'hl/ledger-snapshot-index',
    goal: 'Index the ledger snapshot by settlement date',
    days: 41,
    mergeState: { kind: 'not-merged', ahead: 3 },
    location: 'local-only',
    sha: '9a4b2d6',
  },
  {
    projectId: RELAY_ID,
    branch: 'hl/receipt-email-retry',
    goal: 'Retry failed receipt emails',
    days: 2,
    mergeState: { kind: 'merged-via-merge' },
    location: 'on-origin',
    sha: '7c0e5f3',
  },
  {
    projectId: RELAY_ID,
    branch: 'hl/relay-backoff-jitter',
    goal: 'Add jitter to the relay retry backoff',
    days: 19,
    mergeState: { kind: 'not-merged', ahead: 2 },
    location: 'gone-on-origin',
    sha: 'b82d4c9',
  },
];

const MERGED_PRS: Readonly<Record<string, number>> = {
  'hl/idempotency-column': 311,
  'hl/flaky-retry-test': 88,
  'hl/reconcile-settlement-export': 90,
  'hl/retire-export-cron': 86,
  'hl/nightly-reconciliation': 91,
  'hl/receipt-email-retry': 49,
};

const prOf = (spec: BranchSpec, pr: number): PullRequestState => ({
  number: pr,
  title: spec.goal,
  url: `https://example.invalid/harborline/pull/${pr}`,
  state: 'merged',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: spec.branch,
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: daysAgoIso(spec.days),
});

const githubOf = (spec: BranchSpec) => {
  const pr = MERGED_PRS[spec.branch];
  return {
    linkedIssues: [],
    pr: pr === undefined ? null : prOf(spec, pr),
    fetchedAt: new Date(NOW_MS).toISOString(),
    failedAt: null,
    loading: false,
    error: null,
    detail: null,
    detailFetchedAt: null,
    detailLoading: false,
    detailError: null,
  };
};

const sessionIdOf = (spec: BranchSpec): SessionId =>
  `mock-brand-storage-${spec.branch.replace(/\//g, '-')}` as SessionId;

const sessionOf = (spec: BranchSpec): Session => ({
  id: sessionIdOf(spec),
  workspaceId: SETTINGS_WORKSPACE_ID,
  goal: spec.goal,
  state: { kind: 'idle', lastActivityAt: daysAgoIso(spec.days) },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: spec.projectId,
  createdAt: daysAgoIso(spec.days + 2),
  updatedAt: daysAgoIso(spec.days),
});

const projectBranchOf = (spec: BranchSpec): ProjectBranch => ({
  name: spec.branch,
  sha: spec.sha,
  authorEmail: USER_EMAIL,
  lastCommitAt: Math.floor(daysAgoMs(spec.days) / 1000),
  location: spec.location,
  mergeState: spec.mergeState,
  behind: 0,
});

const scanOf = (projectId: ProjectId): BranchScanEntry => {
  const specs = BRANCHES.filter((spec) => spec.projectId === projectId);
  const goodboy: ReadonlyArray<GoodboyBranch> = specs.map((spec) => ({
    projectId,
    branch: spec.branch,
    sessionId: sessionIdOf(spec),
  }));
  return {
    status: 'ready',
    scan: {
      userEmail: USER_EMAIL,
      branches: [
        {
          name: 'main',
          sha: '0d1c2b3',
          authorEmail: USER_EMAIL,
          lastCommitAt: Math.floor(daysAgoMs(0.2) / 1000),
          location: 'on-origin',
          mergeState: { kind: 'protected' },
          behind: 0,
        },
        ...specs.map(projectBranchOf),
      ],
    },
    goodboy,
  };
};

type FolderSpec = {
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly slug: string;
  readonly days: number;
  readonly sizeBytes: number;
  readonly why: StorageFolder['why'];
};

const FOLDERS: ReadonlyArray<FolderSpec> = [
  {
    projectId: LEDGER_ID,
    branch: 'hl/retire-export-cron',
    slug: 'retire-export-cron-4c1',
    days: 38,
    sizeBytes: 1_912_602_624,
    why: 'archived-session',
  },
  {
    projectId: LEDGER_ID,
    branch: 'hl/flaky-retry-test',
    slug: 'flaky-retry-test-b72',
    days: 34,
    sizeBytes: 2_684_354_560,
    why: 'archived-session',
  },
  {
    projectId: RELAY_ID,
    branch: 'hl/receipt-email-retry',
    slug: 'receipt-email-retry-e09',
    days: 31,
    sizeBytes: 734_003_200,
    why: 'deleted-session',
  },
];

const folderOf = (spec: FolderSpec, index: number): StorageFolder => {
  const repoRoot = rootOf(spec.projectId);
  const path = `${repoRoot}/.goodboy/worktrees/${spec.slug}`;
  const branchSpec = BRANCHES.find((entry) => entry.branch === spec.branch);
  const isDeleted = spec.why === 'deleted-session';
  return {
    path,
    repoRoot,
    branch: spec.branch,
    origin: 'archived',
    why: spec.why,
    sessionId: isDeleted || branchSpec === undefined ? null : sessionIdOf(branchSpec),
    sessionGoal: branchSpec?.goal ?? null,
    mountId: `mock-brand-storage-mount-${index}` as MountId,
    revision: 1,
    ledgerId: null,
    workspaceId: SETTINGS_WORKSPACE_ID,
    sessionActivityAt: daysAgoMs(spec.days),
    sizeBytes: spec.sizeBytes,
    sizedAt: NOW_MS,
    facts: {
      path,
      exists: true,
      isRegistered: true,
      branch: spec.branch,
      lastCommitAt: daysAgoMs(spec.days),
      localOnlyCommits: 0,
      changedFiles: 0,
      changedSample: null,
      reasons: [],
    },
    keptAt: null,
    keptUntil: null,
  };
};

const ROOTS: ReadonlyArray<StorageRoot> = [PAYMENTS_ID, LEDGER_ID, RELAY_ID].map((projectId) => ({
  repoRoot: rootOf(projectId),
  projectName: SETTINGS_PROJECTS.find((project) => project.id === projectId)?.name ?? '',
  workspaceId: SETTINGS_WORKSPACE_ID,
  workspaceName: 'Harborline',
  isDisconnected: false,
}));

const scrollToBranches = (): void => {
  window.setTimeout(() => {
    const section = document.getElementById('storage-worktrees');
    section?.scrollIntoView({ block: 'start' });
    let parent = section?.parentElement ?? null;
    while (parent !== null && parent.scrollTop === 0) {
      parent = parent.parentElement;
    }
    parent?.scrollBy({ top: -28 });
  }, 600);
};

const deletedOf = ({
  id,
  projectId,
  branch,
  sha,
  days,
}: {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly sha: string;
  readonly days: number;
}): DeletedBranch => ({
  id,
  workspaceId: SETTINGS_WORKSPACE_ID,
  projectId,
  sessionId: null,
  repoRoot: rootOf(projectId),
  branch,
  sha,
  keepRef: `refs/goodboy/deleted/${id}`,
  onOrigin: false,
  deletedAt: daysAgoIso(days),
  restoredAt: null,
});

const DELETED: ReadonlyArray<DeletedBranch> = [
  deletedOf({
    id: 'mock-deleted-fee-rounding',
    projectId: PAYMENTS_ID,
    branch: 'hl/fee-rounding',
    sha: '3f9a1c2',
    days: 2,
  }),
  deletedOf({
    id: 'mock-deleted-ledger-index',
    projectId: LEDGER_ID,
    branch: 'hl/ledger-index',
    sha: 'a41d7e0',
    days: 6,
  }),
  deletedOf({
    id: 'mock-deleted-queue-backoff',
    projectId: PAYMENTS_ID,
    branch: 'theo/spike-queue-backoff',
    sha: '9be0c55',
    days: 12,
  }),
];

export const seedStorageScene = (): void => {
  seedBrandSettings();
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: BRANCHES.map(sessionOf),
    sessionGithub: Object.fromEntries(
      BRANCHES.map((spec) => [sessionIdOf(spec), githubOf(spec)]),
    ) as never,
    storageRoots: ROOTS,
    storageFolders: FOLDERS.map(folderOf),
    orphanWorktrees: { [SETTINGS_WORKSPACE_ID]: [] },
    storageStats: state.storageStats === null ? null : { ...state.storageStats, checkedAt: NOW_MS },
    loadStorage: async () => undefined,
    branchScans: {
      [PAYMENTS_ID]: scanOf(PAYMENTS_ID),
      [LEDGER_ID]: scanOf(LEDGER_ID),
      [RELAY_ID]: scanOf(RELAY_ID),
    },
    loadProjectBranches: async () => undefined,
    loadDeletedBranches: async () => undefined,
    deletedBranches: { [SETTINGS_WORKSPACE_ID]: DELETED },
  });
};

const seedBrandStorage = (): void => {
  seedStorageScene();
  scrollToBranches();
};

export const BrandStorageScene = () => (
  <SettingsFrame focus={{ scope: 'app', section: 'storage' }} seed={seedBrandStorage} />
);
