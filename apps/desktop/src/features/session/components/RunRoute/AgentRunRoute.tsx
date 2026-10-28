import { useEffect, useMemo } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { parseRunRoutes, runRoutesKey } from '../../startRun/runRoutesSetting';
import { RunKindChip } from './RunKindChip';
import { runKindPhaseOf } from './runKindPhaseOf';

type Props = {
  readonly session: Session;
  readonly agentId: AgentId;
};

export const AgentRunRoute = ({ session, agentId }: Props) => {
  const sessionId = session.id;
  const key = runRoutesKey({ sessionId });
  const raw = useAppStore((state) => state.settings[key]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const route = useMemo(() => parseRunRoutes({ raw })[agentId] ?? null, [raw, agentId]);
  const target = useMemo(
    () => ({ kind: 'lead' as const, sessionId, agentId }),
    [sessionId, agentId],
  );

  const reportError = useAppStore((state) => state.reportError);
  const status = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId]?.find((agent) => agent.id === agentId)?.status,
  );

  useEffect(() => {
    loadSetting(key).catch((error: unknown) => {
      void reportError({ title: "Couldn't read how this run was started", error });
    });
  }, [key, loadSetting, reportError]);

  if (route === null) {
    return null;
  }
  return (
    <RunKindChip
      workspaceId={session.workspaceId}
      target={target}
      route={route}
      changeCount={0}
      phase={runKindPhaseOf({
        agentCount: 1,
        isFinished: false,
        phase: null,
        status: status ?? null,
      })}
    />
  );
};
