import type { HistoryBackup } from '@goodboy/types';
import { historyBackupRef } from '../../../../../features/history/historyBackupRef';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { BRAND_SESSION } from './canon';
import { CTX_PAYMENTS_WORKTREE, CTX_SESSION } from './contextBase';
import { CTX_COMMITS, CTX_STATUS } from './contextBranch';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';

const BACKUP_AT_MS = Date.now() - 26 * 3600 * 1000;

const BACKUPS: ReadonlyArray<HistoryBackup> = [
  {
    refName: historyBackupRef({ branch: BRAND_SESSION.branch, atMs: BACKUP_AT_MS }),
    sha: '5e2b8d0f4a7c1e9b3d6f8a2c5e0b7d4f1a9c3e6b',
    subject: 'Dedupe webhook retries in the handler',
    createdAt: Math.floor(BACKUP_AT_MS / 1000),
    isLegacy: false,
  },
];

const HANDLERS: FakeHandlers = {
  worktree_status: () => CTX_STATUS,
  worktree_commits: () => CTX_COMMITS,
  history_backups_list: () => BACKUPS,
};

export const HistoryStage = () => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 4000 });
  return <BranchPage session={CTX_SESSION} workingDir={CTX_PAYMENTS_WORKTREE} />;
};
