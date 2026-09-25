import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import {
  selectMountPresence,
  type MountPresenceAgent,
} from '../../../../../../store/slices/project-mounts/selectMountPresence';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const useMountPresence = ({
  sessionId,
  mountId,
}: Params): ReadonlyArray<MountPresenceAgent> => {
  const agentIds = useAppStore(
    useShallow((state) =>
      selectMountPresence({ state, sessionId, mountId }).map((agent) => agent.agentId),
    ),
  );
  const states = useAppStore(
    useShallow((state) =>
      selectMountPresence({ state, sessionId, mountId }).map((agent) => agent.state),
    ),
  );
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId]);

  return useMemo(
    () =>
      agentIds.flatMap((agentId, index) => {
        const agent = agents?.find((candidate) => candidate.id === agentId);
        const state = states[index];
        return agent === undefined || state === undefined
          ? []
          : [{ agentId, name: agent.name, state }];
      }),
    [agentIds, states, agents],
  );
};
