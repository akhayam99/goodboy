import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMonitorPolling } from '../../../monitoring/hooks/useMonitorPolling';
import { useAppStore } from '../../../../store';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { expectedPort } from '../../expectedPort';
import { invokeScriptListLive, type ScriptRunRecord } from '../../scripts';
import { scriptLiveFacts, type ScriptLiveFacts } from '../../scriptLiveFacts';

type Params = {
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
};

type HolderParams = {
  readonly port: number;
  readonly worktreePath: string;
};

type ExpectedParams = {
  readonly projectId: string;
  readonly scriptName: string;
};

type ScriptLive = {
  readonly factsByRunId: Readonly<Record<string, ScriptLiveFacts>>;
  readonly expectedPortOf: (params: ExpectedParams) => number | null;
  readonly holderOf: (params: HolderParams) => string | null;
};

const NO_PIDS: Readonly<Record<string, number>> = {};

export const useScriptLive = ({ runs }: Params): ScriptLive => {
  useMonitorPolling();
  const snapshot = useAppStore((state) => state.monitorSnapshot);
  const portRows = useAppStore(selectPortRows);
  const scanned = useAppStore((state) => state.monitorScanned);
  const projects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) => state.sessionMounts);
  const reportError = useAppStore((state) => state.reportError);
  const [pids, setPids] = useState<Readonly<Record<string, number>>>(NO_PIDS);

  const pendingKey = useMemo(
    () =>
      Object.values(runs ?? {})
        .filter((record) => record.status === 'pending')
        .map((record) => record.runId)
        .sort()
        .join(','),
    [runs],
  );

  useEffect(() => {
    if (pendingKey === '') {
      setPids(NO_PIDS);
      return undefined;
    }
    let isCurrent = true;
    invokeScriptListLive()
      .then((live) => {
        if (!isCurrent) {
          return;
        }
        setPids(
          Object.fromEntries(
            live.flatMap((run) => (run.pid === null ? [] : [[run.runId, run.pid] as const])),
          ),
        );
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          reportError({ title: "Couldn't read the running scripts", error });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [pendingKey, reportError]);

  const factsByRunId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pids).map(([runId, pid]) => [runId, scriptLiveFacts({ snapshot, pid })]),
      ),
    [pids, snapshot],
  );

  const expectedPortOf = useCallback(
    ({ projectId, scriptName }: ExpectedParams) =>
      expectedPort({ scanned: scanned[projectId], scriptName }),
    [scanned],
  );

  const holderOf = useCallback(
    ({ port, worktreePath }: HolderParams): string | null => {
      const row = portRows.find((candidate) => candidate.port === port);
      const owner = row?.owner ?? null;
      if (row === undefined || row.state !== 'listening' || owner === null) {
        return null;
      }
      if (owner.kind === 'external') {
        return `${owner.name} holds it`;
      }
      if (owner.kind === 'project' || owner.worktreePath === null) {
        return null;
      }
      if (owner.worktreePath === worktreePath) {
        return null;
      }
      const projectName = projects.find((project) => project.id === owner.projectId)?.name;
      const ownerPath = owner.worktreePath;
      const branch = Object.values(sessionMounts)
        .flat()
        .find((mount) => mount.worktreePath === ownerPath)?.branch;
      const parts = [projectName, branch].filter(
        (part): part is string => part !== undefined && part !== '',
      );
      return parts.length === 0 ? 'Another worktree holds it' : `${parts.join(' · ')} holds it`;
    },
    [portRows, projects, sessionMounts],
  );

  return { factsByRunId, expectedPortOf, holderOf };
};
