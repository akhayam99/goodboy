import { useContext, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderRunId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { runSpendUsd } from '../../../../../store/slices/workflows/runSpendUsd';
import { useNow } from '../../../../../shared/hooks/useNow';
import { checkNameOf } from '../../../../branch/checks/checkNameOf';
import { WorkTimeContext } from '../../../../workTreeModel/workTimeSource';
import { agentSpendById } from '../../../timeline/agentSpendById';
import type { SessionWorkModel } from '../../useSessionWorkModel';
import { doneRowsOf } from '../doneRowsOf';
import type { DoneCosts, DoneDay } from '../doneTypes';

type Params = {
  readonly session: Session;
  readonly model: SessionWorkModel;
  readonly now?: number;
};

export const useDoneRows = ({ session, model, now }: Params): ReadonlyArray<DoneDay> => {
  const sessionId = session.id;
  const source = useContext(WorkTimeContext);
  const clock = useNow(30_000, now === undefined);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const telemetry = useAppStore((s) => s.sessionTelemetry[sessionId] ?? EMPTY_ARRAY);
  const mountGithub = useAppStore((s) => s.mountGithub);
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const history: Record<string, ReadonlyArray<ProviderRunId>> = {};
      for (const agent of agents) {
        const runIds = s.agentRunHistory[agent.id];
        if (runIds != null) {
          history[agent.id] = runIds;
        }
      }
      return history;
    }),
  );
  const { entries, events, autoTrees, workflows } = model;

  const costs = useMemo((): DoneCosts => {
    const byAgentId = new Map<string, number>(
      agentSpendById({ records: telemetry, agents, agentRunHistory }),
    );
    const byRunId = new Map<string, number>(
      workflows.map(({ run }) => [
        run.id,
        runSpendUsd({ records: telemetry, agents, agentRunHistory, workflowRunId: run.id }),
      ]),
    );
    return { byAgentId, byRunId };
  }, [agentRunHistory, agents, telemetry, workflows]);

  const checkNameByAgentId = useMemo(() => {
    const names = new Map<string, string>();
    for (const agent of agents) {
      if (
        agent.sourceKind !== 'failed_check' ||
        agent.sourceCommentUrl === undefined ||
        agent.mountId === undefined
      ) {
        continue;
      }
      const name = checkNameOf({
        state: { mountGithub },
        mountId: agent.mountId,
        url: agent.sourceCommentUrl,
      });
      if (name !== null) {
        names.set(agent.id, name);
      }
    }
    return names;
  }, [agents, mountGithub]);

  const at = now ?? clock;
  return useMemo(
    () =>
      doneRowsOf({
        model: { entries, events, autoTrees, agents, checkNameByAgentId, now: at },
        source,
        costs,
      }),
    [agents, at, autoTrees, checkNameByAgentId, costs, entries, events, source],
  );
};
