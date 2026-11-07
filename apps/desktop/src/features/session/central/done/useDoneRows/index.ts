import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { checkNameOf } from '../../../../branch/checks/checkNameOf';
import { useSessionMountHosts } from '../../../../../shared/hooks/useSessionMountHosts';
import type { SessionWorkModel } from '../../useSessionWorkModel';
import { doneRowsOf } from '../doneRowsOf';
import type { DoneDay } from '../doneTypes';

type Params = {
  readonly session: Session;
  readonly model: SessionWorkModel;
  readonly now?: number;
};

export const useDoneRows = ({ session, model, now }: Params): ReadonlyArray<DoneDay> => {
  const sessionId = session.id;
  const { entries, events, autoTrees } = model;
  const hasDoneSources = entries.length > 0 || events.length > 0 || autoTrees.length > 0;
  const clock = useNow(30_000, now === undefined && hasDoneSources);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const agentMountIds = useMemo(
    () => agents.flatMap((agent) => (agent.mountId === undefined ? [] : [agent.mountId])),
    [agents],
  );
  const { mountGithub } = useSessionMountHosts({ sessionId, extraMountIds: agentMountIds });
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
      }),
    [agents, at, autoTrees, checkNameByAgentId, entries, events],
  );
};
