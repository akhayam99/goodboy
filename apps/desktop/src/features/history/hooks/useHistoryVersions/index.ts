import { useEffect, useState } from 'react';
import type { HistoryBackup, HistoryBackupFacts, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { runWithLimit } from '../../../../shared/utils/runWithLimit';
import { listHistoryBackups, readHistoryBackupFacts } from '../../historyEngine';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly baseRef: string | null;
  readonly headSha: string | null;
  readonly revision: number;
};

const FACTS_CONCURRENCY = 4;

export type HistoryVersion = {
  readonly backup: HistoryBackup;
  readonly facts: HistoryBackupFacts | null;
};

export const useHistoryVersions = ({
  sessionId,
  worktreePath,
  branch,
  baseRef,
  headSha,
  revision,
}: Params): ReadonlyArray<HistoryVersion> | null => {
  const [versions, setVersions] = useState<ReadonlyArray<HistoryVersion> | null>(null);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    let isCurrent = true;
    setVersions(null);
    type ReportParams = {
      readonly error: unknown;
    };

    const report = ({ error }: ReportParams) => {
      void reportError({
        title: "Couldn't read the previous versions",
        error,
        severity: 'warning',
        sessionId,
      });
    };
    const load = async (): Promise<ReadonlyArray<HistoryVersion>> => {
      const backups = await listHistoryBackups({ worktreePath, branch });
      const versionsFound: Array<HistoryVersion> = backups.map((backup) => ({
        backup,
        facts: null,
      }));
      if (baseRef === null || headSha === null) {
        return versionsFound;
      }
      await runWithLimit({
        tasks: backups.map((backup, index) => async () => {
          if (!isCurrent) {
            return;
          }
          const facts = await readHistoryBackupFacts({
            worktreePath,
            baseRef,
            backupSha: backup.sha,
            nextSha: backups[index - 1]?.sha ?? headSha,
            head: headSha,
          }).catch((error: unknown) => {
            if (isCurrent) {
              report({ error });
            }
            return null;
          });
          versionsFound[index] = { backup, facts };
        }),
        limit: FACTS_CONCURRENCY,
      });
      return versionsFound;
    };
    load()
      .then((found) => {
        if (isCurrent) {
          setVersions(found);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setVersions([]);
          report({ error });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [baseRef, branch, headSha, reportError, revision, sessionId, worktreePath]);

  return versions;
};
