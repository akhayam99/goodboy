import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PrCheckRun, Session, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { failingChecksOf } from '../../../branch/checks/failingChecksOf';
import type { SuggestionFailedCheck } from '../../deriveNextSteps';
import type { SignalCheckLog } from '../../nextStepSignals';
import { actionsJobOf } from '../../signals/actionsJobOf';

type Params = {
  readonly session: Session;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type FailedRow = {
  readonly mountId: string;
  readonly prNumber: number;
  readonly check: PrCheckRun;
};

export type CheckSignals = {
  readonly failedChecks: Readonly<Record<string, ReadonlyArray<SuggestionFailedCheck>>>;
  readonly checkLogs: ReadonlyArray<SignalCheckLog>;
};

const NO_CHECKS: ReadonlyArray<SuggestionFailedCheck> = [];

export const useCheckSignals = ({ session, mounts }: Params): CheckSignals => {
  const sessionId = session.id;
  const rowsJson = useAppStore((state) =>
    JSON.stringify(
      mounts.flatMap((mount): ReadonlyArray<FailedRow> => {
        const prNumber = state.mountGithub[mount.mountId]?.pr?.number ?? null;
        if (prNumber === null) {
          return [];
        }
        const failing = failingChecksOf({ state, sessionId, mountId: mount.mountId, prNumber });
        return (failing?.checks ?? []).map((check) => ({
          mountId: mount.mountId,
          prNumber,
          check,
        }));
      }),
    ),
  );
  const rows = useMemo((): ReadonlyArray<FailedRow> => JSON.parse(rowsJson), [rowsJson]);
  const failedChecks = useMemo(() => {
    const byMount: Record<string, SuggestionFailedCheck[]> = {};
    for (const row of rows) {
      byMount[row.mountId] = [
        ...(byMount[row.mountId] ?? NO_CHECKS),
        { name: row.check.name, detailsUrl: row.check.detailsUrl },
      ];
    }
    return byMount;
  }, [rows]);
  const urls = useMemo(
    () =>
      rows.flatMap((row) =>
        actionsJobOf({ detailsUrl: row.check.detailsUrl }) === null
          ? []
          : [row.check.detailsUrl ?? ''],
      ),
    [rows],
  );
  const readings = useAppStore(
    useShallow((state) => urls.map((url) => state.checkLogs[url] ?? null)),
  );
  const readCheckLog = useAppStore((state) => state.readCheckLog);
  useEffect(() => {
    for (const row of rows) {
      const mount = mounts.find((candidate) => candidate.mountId === row.mountId);
      if (mount === undefined || actionsJobOf({ detailsUrl: row.check.detailsUrl }) === null) {
        continue;
      }
      void readCheckLog({
        check: row.check,
        cwd: mount.worktreePath,
        workspaceId: session.workspaceId,
        projectId: mount.projectId,
      });
    }
  }, [mounts, readCheckLog, rows, session.workspaceId]);
  const checkLogs = useMemo(
    () => readings.flatMap((reading) => (reading === null ? [] : [reading])),
    [readings],
  );
  return useMemo(() => ({ failedChecks, checkLogs }), [checkLogs, failedChecks]);
};
