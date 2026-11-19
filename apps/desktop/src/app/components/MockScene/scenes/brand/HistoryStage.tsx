import { useMemo } from 'react';
import type { BranchCommit, HistoryBackup } from '@goodboy/types';
import { historyBackupRef } from '../../../../../features/history/testing/historyBackupRef';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { CTX_COMMITS, CTX_STATUS } from './contextBranch';
import { useFakeTauri, type FakeHandlers } from './fakeTauri';
import { CTX_HISTORY_SCOPE, type HistoryScope } from './historySceneSeed';

const BACKUP_AT_MS = Date.now() - 26 * 3600 * 1000;

type BackupParams = Pick<HistoryScope, 'branch' | 'backupSubject'>;

const backupsOf = ({ branch, backupSubject }: BackupParams): ReadonlyArray<HistoryBackup> => [
  {
    refName: historyBackupRef({ branch, atMs: BACKUP_AT_MS }),
    sha: '5e2b8d0f4a7c1e9b3d6f8a2c5e0b7d4f1a9c3e6b',
    subject: backupSubject,
    createdAt: Math.floor(BACKUP_AT_MS / 1000),
    isLegacy: false,
  },
];

type HandlerParams = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly scope: HistoryScope;
};

const handlersOf = ({ commits, scope }: HandlerParams): FakeHandlers => {
  const status = {
    ...CTX_STATUS,
    branch: scope.branch,
    upstream: `origin/${scope.branch}`,
    upstreamDistance: {
      kind: 'known',
      ahead: commits.filter((commit) => !commit.pushed).length,
      behind: 0,
    },
    mainDistance: { kind: 'known', ahead: commits.length, behind: 0 },
  } as const;
  const backups = backupsOf(scope);
  return {
    worktree_status: () => status,
    worktree_commits: () => commits,
    history_backups_list: () => backups,
  };
};

type Props = {
  readonly commits?: ReadonlyArray<BranchCommit>;
  readonly scope?: HistoryScope;
};

export const HistoryStage = ({ commits = CTX_COMMITS, scope = CTX_HISTORY_SCOPE }: Props) => {
  const handlers = useMemo(() => handlersOf({ commits, scope }), [commits, scope]);
  useFakeTauri({ handlers, holdMs: 4000 });
  return <BranchPage session={scope.session} workingDir={scope.worktree} />;
};
