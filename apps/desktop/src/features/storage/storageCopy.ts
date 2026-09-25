import type { ArtifactKind, WorktreeRemovalReason } from '@goodboy/types';
import type {
  StorageFolder,
  StorageFolderStatus,
  StorageFolderWhy,
} from '../../store/slices/storage/types';

const WHY_LABEL = {
  'active-session': 'Session in progress',
  'archived-session': 'Archived session',
  'deleted-session': 'Deleted session',
  'no-session': 'No session found',
  'kept-by-goodboy': 'Kept by Goodboy',
} as const satisfies Record<StorageFolderWhy, string>;

type FolderParams = {
  readonly folder: StorageFolder;
};

export const folderWhyLine = ({ folder }: FolderParams): string => {
  const why = WHY_LABEL[folder.why];
  const goal = folder.sessionGoal?.trim() ?? '';
  return goal === '' ? why : `${why} · ${goal}`;
};

type CountParams = {
  readonly count: number;
};

const filesNotCommitted = ({ count }: CountParams): string =>
  count === 1 ? '1 file not committed' : `${count} files not committed`;

type StatusParams = FolderParams & {
  readonly status: StorageFolderStatus;
};

export const folderStatusLabel = ({ folder, status }: StatusParams): string => {
  switch (status) {
    case 'in-use':
      return 'In use';
    case 'checking':
      return 'Checking…';
    case 'safe':
      return 'Safe to remove';
    case 'dirty':
      return filesNotCommitted({ count: Math.max(1, folder.facts?.changedFiles ?? 1) });
    case 'writing':
      return 'An agent is writing here';
    case 'operation':
      return 'A git operation is in progress';
    case 'not-tracked':
      return "Git doesn't track this folder";
    case 'unavailable':
      return "Couldn't check this folder";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

export const localCommitsNote = ({ folder }: FolderParams): string | null => {
  const count = folder.facts?.localOnlyCommits ?? 0;
  if (count === 0) {
    return null;
  }
  const branch = folder.branch === '' ? 'the branch' : folder.branch;
  const commits = count === 1 ? '1 commit' : `${count} commits`;
  return `${commits} only on this Mac, they stay on ${branch}`;
};

type SinceParams = {
  readonly from: number | null;
  readonly now: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatSince = ({ from, now }: SinceParams): string => {
  if (from === null) {
    return '';
  }
  const elapsed = Math.max(0, now - from);
  if (elapsed < HOUR) {
    return `${Math.max(1, Math.round(elapsed / MINUTE))} min`;
  }
  if (elapsed < DAY) {
    return `${Math.round(elapsed / HOUR)} h`;
  }
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? '1 day' : `${days} days`;
};

export const formatAgo = ({ from, now }: SinceParams): string => {
  const since = formatSince({ from, now });
  return since === '' ? '' : `${since} ago`;
};

export const ARTIFACT_KIND_LABEL = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
} as const satisfies Record<ArtifactKind, string>;

const REASON_COPY: ReadonlyArray<readonly [WorktreeRemovalReason, string]> = [
  ['writer-lease-held', 'an agent is writing there'],
  ['operation-in-progress', 'a git operation is in progress'],
  ['unmerged-conflicts', 'it has unresolved conflicts'],
  ['staged-changes', 'it has changes not committed'],
  ['unstaged-changes', 'it has changes not committed'],
  ['untracked-files', 'it has changes not committed'],
  ['not-registered', "git doesn't track it"],
  ['locked', 'git locked it'],
  ['status-unavailable', "its git status couldn't be read"],
];

type ReasonsParams = {
  readonly reasons: ReadonlyArray<WorktreeRemovalReason>;
  readonly message: string | null;
};

export const keptReasonPhrase = ({ reasons, message }: ReasonsParams): string => {
  const match = REASON_COPY.find(([reason]) => reasons.includes(reason));
  if (match !== undefined) {
    return match[1];
  }
  return message ?? 'it changed while the cleanup ran';
};
