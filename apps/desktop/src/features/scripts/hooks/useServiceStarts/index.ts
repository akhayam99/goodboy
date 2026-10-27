import { useCallback, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { RunnableScript, SessionScriptGroup } from '../../buildSessionScripts';
import { endedServicesOf } from '../../endedServicesOf';
import { scriptRunRecordFor } from '../../scriptRunRecordFor';
import type { ScriptRunRecord } from '../../scripts';

type RowParams = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

type Params = {
  readonly sessionId: SessionId;
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly onRun: (params: RowParams) => void;
};

export type StartAllParams = {
  readonly group: SessionScriptGroup;
  readonly services: ReadonlyArray<RunnableScript>;
};

export type EndedServices = {
  readonly count: number;
  readonly onStart: () => void;
  readonly onDismiss: () => void;
};

export type ServiceStarts = {
  readonly onStartAll: (params: StartAllParams) => void;
  readonly ended: EndedServices;
};

export const useServiceStarts = ({ sessionId, groups, runs, onRun }: Params): ServiceStarts => {
  const endedWork = useAppStore((state) => state.endedWork ?? null);
  const dismissEndedScripts = useAppStore((state) => state.dismissEndedScripts);

  const onStartAll = useCallback(
    ({ group, services }: StartAllParams) => {
      for (const script of services) {
        if (scriptRunRecordFor({ runs, group, script })?.status !== 'pending') {
          onRun({ group, script });
        }
      }
    },
    [onRun, runs],
  );

  const endedServices = useMemo(
    () =>
      endedServicesOf({ ended: endedWork, sessionId, groups }).filter(
        ({ group, script }) => scriptRunRecordFor({ runs, group, script })?.status !== 'pending',
      ),
    [endedWork, groups, runs, sessionId],
  );

  const ended = useMemo(
    () => ({
      count: endedServices.length,
      onStart: () => {
        for (const { group, script } of endedServices) {
          onRun({ group, script });
        }
        dismissEndedScripts({ sessionId });
      },
      onDismiss: () => dismissEndedScripts({ sessionId }),
    }),
    [dismissEndedScripts, endedServices, onRun, sessionId],
  );

  return { onStartAll, ended };
};
