import type { HistoryBackup } from '@goodboy/types';
import { FilesPane } from '../../../../../features/session/components/SessionWorkspace/parts/FilesPane';
import { BRAND_SESSION } from './canon';
import { CTX_PAYMENTS_WORKTREE, CTX_SESSION_ID } from './contextBase';
import { CTX_COMMITS, CTX_STATUS } from './contextBranch';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';

const BACKUPS: ReadonlyArray<HistoryBackup> = [
  {
    refName: `refs/goodboy/backups/${BRAND_SESSION.branch}/1727340000`,
    sha: '5e2b8d0f4a7c1e9b3d6f8a2c5e0b7d4f1a9c3e6b',
    subject: 'Dedupe webhook retries in the handler',
    createdAt: Math.floor(Date.now() / 1000) - 26 * 3600,
  },
];

const HANDLERS: FakeHandlers = {
  worktree_status: () => CTX_STATUS,
  worktree_commits: () => CTX_COMMITS,
  history_backups_list: () => BACKUPS,
};

export const HistoryStage = () => {
  useFakeTauri({ handlers: HANDLERS, holdMs: 4000 });
  return (
    <FilesPane
      sessionId={CTX_SESSION_ID}
      sessionDir={CTX_PAYMENTS_WORKTREE}
      worktreePath={CTX_PAYMENTS_WORKTREE}
      isBranchless={false}
      onClose={() => undefined}
    />
  );
};
