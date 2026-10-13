import type { HistoryBackup, HistoryBackupFacts } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';
import { CTX_COMMITS } from '../brand/contextBranch';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

type AtParams = {
  readonly at: string;
};

const secondsOf = ({ at }: AtParams): number => Math.floor(clock.ms({ at }) / 1000);

const NAMESPACE = 'refs/goodboy/backup/b-686c2f6c6564676572';

export const REBASE_ROW_BRANCH_PATH = '~/code/harborline/payments-api-fix-duplicate-credit';

export const REBASE_ROW_BRANCHES: ReadonlyArray<string> = ['main', 'release/2.4', 'develop'];

const oldest = [...CTX_COMMITS].reverse();

type IndexParams = {
  readonly index: number;
};

const sha = ({ index }: IndexParams): string => CTX_COMMITS[index]?.sha ?? '';

export const REBASE_ROW_BACKUPS: ReadonlyArray<HistoryBackup> = [
  {
    refName: `${NAMESPACE}/1790000000000000000`,
    sha: sha({ index: 1 }),
    subject: CTX_COMMITS[1]?.subject ?? '',
    createdAt: secondsOf({ at: '2026-10-10T07:40:00.000Z' }),
    isLegacy: false,
  },
  {
    refName: `${NAMESPACE}/1789900000000000000`,
    sha: sha({ index: 2 }),
    subject: CTX_COMMITS[2]?.subject ?? '',
    createdAt: secondsOf({ at: '2026-10-09T15:05:00.000Z' }),
    isLegacy: false,
  },
  {
    refName: `${NAMESPACE}/1789800000000000000`,
    sha: sha({ index: 3 }),
    subject: CTX_COMMITS[3]?.subject ?? '',
    createdAt: secondsOf({ at: '2026-10-08T11:20:00.000Z' }),
    isLegacy: false,
  },
];

const REBASE_ROW_FACTS: Readonly<Record<string, HistoryBackupFacts>> = {
  [sha({ index: 1 })]: {
    commits: oldest.slice(0, 7).map(({ sha: commitSha, subject }) => ({ sha: commitSha, subject })),
    isSameForkAsNext: false,
    nextCommitCount: 7,
    filesChangedVsNow: 3,
    additionsVsNow: 41,
    deletionsVsNow: 12,
  },
  [sha({ index: 2 })]: {
    commits: oldest.slice(0, 8).map(({ sha: commitSha, subject }) => ({ sha: commitSha, subject })),
    isSameForkAsNext: true,
    nextCommitCount: 7,
    filesChangedVsNow: 5,
    additionsVsNow: 63,
    deletionsVsNow: 20,
  },
  [sha({ index: 3 })]: {
    commits: oldest.slice(0, 8).map(({ sha: commitSha, subject }) => ({ sha: commitSha, subject })),
    isSameForkAsNext: true,
    nextCommitCount: 8,
    filesChangedVsNow: 2,
    additionsVsNow: 9,
    deletionsVsNow: 4,
  },
};

type FactsParams = {
  readonly payload: unknown;
};

export const factsOfPayload = ({ payload }: FactsParams): HistoryBackupFacts | null => {
  if (typeof payload !== 'object' || payload === null || !('backupSha' in payload)) {
    return null;
  }
  return REBASE_ROW_FACTS[String(payload.backupSha)] ?? null;
};
