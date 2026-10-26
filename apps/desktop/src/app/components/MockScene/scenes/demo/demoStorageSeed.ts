import { brandId, type MountId, type ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { StorageFolder } from '../../../../../store/slices/storage/types';
import { STORAGE_SUGGEST_AFTER_KEY } from '../../../../../store/slices/storage/storageSettings';
import { SETTINGS_PROJECTS, SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { seedStorageScene } from '../brand/StorageScene';
import { STORY_PROJECTS } from './storyProjects';

const DAY_MS = 24 * 60 * 60 * 1000;
const MB = 1024 * 1024;
const GB = 1024 * MB;

type FolderSpec = {
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly slug: string;
  readonly goal: string;
  readonly days: number;
  readonly sizeBytes: number;
  readonly isInUse: boolean;
};

const STORY_FOLDER_SPECS: ReadonlyArray<FolderSpec> = [
  {
    projectId: STORY_PROJECTS.payments,
    branch: 'hl/retry-credit-notes',
    slug: 'retry-credit-notes-4c1',
    goal: 'Retry credit notes after a provider timeout',
    days: 18,
    sizeBytes: 1.4 * GB,
    isInUse: false,
  },
  {
    projectId: STORY_PROJECTS.payments,
    branch: 'hl/surface-retry-state',
    slug: 'surface-retry-state-b72',
    goal: 'Show the retry state on a failed delivery',
    days: 24,
    sizeBytes: 1.1 * GB,
    isInUse: false,
  },
  {
    projectId: STORY_PROJECTS.ledger,
    branch: 'hl/refactor-rate-table',
    slug: 'refactor-rate-table-e09',
    goal: 'Move the rate table into its own module',
    days: 31,
    sizeBytes: 0.9 * GB,
    isInUse: false,
  },
  {
    projectId: STORY_PROJECTS.payments,
    branch: 'hl/per-tenant-limits',
    slug: 'per-tenant-limits-a1d',
    goal: 'Per-tenant limits on the public API',
    days: 0,
    sizeBytes: 1.2 * GB,
    isInUse: true,
  },
];

const rootOf = (projectId: ProjectId): string =>
  SETTINGS_PROJECTS.find((project) => project.id === projectId)?.rootPath ?? '';

type FolderParams = {
  readonly spec: FolderSpec;
  readonly index: number;
  readonly nowMs: number;
};

const folderOf = ({ spec, index, nowMs }: FolderParams): StorageFolder => {
  const repoRoot = rootOf(spec.projectId);
  const path = `${repoRoot}/.goodboy/worktrees/${spec.slug}`;
  const activityAt = nowMs - spec.days * DAY_MS;
  return {
    path,
    repoRoot,
    branch: spec.branch,
    origin: spec.isInUse ? 'in-use' : 'archived',
    why: spec.isInUse ? 'active-session' : 'archived-session',
    sessionId: null,
    sessionGoal: spec.goal,
    mountId: brandId<MountId>({ value: `demo-storage-mount-${index}` }),
    revision: 1,
    ledgerId: null,
    workspaceId: SETTINGS_WORKSPACE_ID,
    sessionActivityAt: activityAt,
    sizeBytes: Math.round(spec.sizeBytes),
    sizedAt: nowMs,
    facts: {
      path,
      exists: true,
      isRegistered: true,
      branch: spec.branch,
      lastCommitAt: activityAt,
      localOnlyCommits: 0,
      changedFiles: 0,
      changedSample: null,
      reasons: [],
    },
    keptAt: null,
    keptUntil: null,
  };
};

export const seedDemoStorage = (): void => {
  seedStorageScene();
  const nowMs = Date.now();
  useAppStore.setState((state) => ({
    storageFolders: STORY_FOLDER_SPECS.map((spec, index) => folderOf({ spec, index, nowMs })),
    settings: { ...state.settings, [STORAGE_SUGGEST_AFTER_KEY]: '7' },
    folderHistorySizes: {
      [STORY_PROJECTS.runbooks]: {
        usedBytes: 18 * MB,
        capBytes: 1024 * MB,
        usedShare: 18 / 1024,
        versionCount: 12,
      },
    },
    loadFolderHistorySize: async () => undefined,
  }));
};
