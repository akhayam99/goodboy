import { useEffect } from 'react';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { StorageFolder } from '../../../../../store/slices/storage/types';
import type { WorktreeFolderFacts } from '../../../../../features/worktree/worktree';
import { projectWorktreesEventOf } from '../../../../../features/storage/projectWorktreesEventOf';
import { CentralColumnScene } from '../u26/CentralColumnScene';
import { COLUMN_SESSION_ID } from '../u26/centralColumnSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isOpen: boolean;
};

const OPEN_DELAY_MS = 400;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MB = 1024 * 1024;

type FolderSpec = {
  readonly slug: string;
  readonly branch: string;
  readonly goal: string | null;
  readonly origin: StorageFolder['origin'];
  readonly why: StorageFolder['why'];
  readonly sizeBytes: number;
  readonly ageMs: number;
  readonly verdict: WorktreeFolderFacts['verdict'];
  readonly changedFiles: number;
  readonly ahead: number;
  readonly isHost: boolean;
};

const SPECS: ReadonlyArray<FolderSpec> = [
  {
    slug: 'tenant-limits',
    branch: 'hl/tenant-limits',
    goal: 'Per-tenant limits on payouts',
    origin: 'in-use',
    why: 'active-session',
    sizeBytes: 612 * MB,
    ageMs: 2 * HOUR,
    verdict: 'dirty',
    changedFiles: 3,
    ahead: 0,
    isHost: true,
  },
  {
    slug: 'refund-retry',
    branch: 'ak/eng-1176-refund-retry',
    goal: 'Retry failed refunds with backoff',
    origin: 'in-use',
    why: 'active-session',
    sizeBytes: 388 * MB,
    ageMs: DAY,
    verdict: 'safe',
    changedFiles: 0,
    ahead: 2,
    isHost: false,
  },
  {
    slug: 'webhook-dedupe',
    branch: 'ak/eng-1141-webhook-dedupe',
    goal: 'Dedupe Acme webhooks',
    origin: 'archived',
    why: 'archived-session',
    sizeBytes: 140 * MB,
    ageMs: 9 * DAY,
    verdict: 'safe',
    changedFiles: 0,
    ahead: 0,
    isHost: false,
  },
];

type FolderParams = {
  readonly spec: FolderSpec;
  readonly repoRoot: string;
  readonly now: number;
};

const folderOf = ({ spec, repoRoot, now }: FolderParams): StorageFolder => {
  const path = `${repoRoot}/.goodboy/worktrees/${spec.slug}`;
  return {
    path,
    repoRoot,
    branch: spec.branch,
    origin: spec.origin,
    why: spec.why,
    sessionId: spec.isHost
      ? COLUMN_SESSION_ID
      : brandId<SessionId>({ value: `mock-worktrees-session-${spec.slug}` }),
    sessionGoal: spec.goal,
    mountId: brandId<MountId>({ value: `mock-worktrees-mount-${spec.slug}` }),
    revision: 1,
    ledgerId: null,
    workspaceId: null,
    sessionActivityAt: now - spec.ageMs,
    sizeBytes: spec.sizeBytes,
    sizedAt: now,
    facts: {
      path,
      exists: true,
      isRegistered: true,
      branch: spec.branch,
      lastCommitAt: now - spec.ageMs,
      localOnlyCommits: spec.ahead,
      changedFiles: spec.changedFiles,
      changedSample: spec.changedFiles > 0 ? 'src/payouts/limits.ts' : null,
      reasons: spec.verdict === 'dirty' ? ['unstaged-changes'] : [],
      verdict: spec.verdict,
    },
    keptAt: null,
    keptUntil: null,
  };
};

export const WorktreesScene = ({ theme, isOpen }: Props) => {
  useEffect(() => {
    const [project] = useAppStore.getState().projects;
    if (project === undefined) {
      return;
    }
    const now = Date.now();
    useAppStore.setState({
      storageFolders: SPECS.map((spec) => folderOf({ spec, repoRoot: project.rootPath, now })),
      loadStorage: async () => undefined,
      measureStorageSizes: async () => undefined,
    });
    if (!isOpen) {
      return;
    }
    let timer = 0;
    const request = () => {
      if (document.querySelector('[data-board-project-head]') === null) {
        timer = window.setTimeout(request, OPEN_DELAY_MS);
        return;
      }
      window.dispatchEvent(
        new CustomEvent(
          projectWorktreesEventOf({ sessionId: COLUMN_SESSION_ID, projectId: project.id }),
        ),
      );
    };
    timer = window.setTimeout(request, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
  return <CentralColumnScene theme={theme} kind="finished" />;
};
