import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { AGENT_KIND_META, classifyAgent } from '../../../../agent-kind';
import type { LiveGroupModel } from '../../liveGroupsOf';
import { nowRowsOf, type NowModel, type NowWriterWait } from '../../nowRowsOf';
import { useSessionWork } from '../useSessionWork';

type Params = {
  readonly sessionId: SessionId;
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

export type NowView = NowModel &
  Readonly<{
    isLoaded: boolean;
  }>;

export const useNowModel = ({ sessionId, groups }: Params): NowView => {
  const { work, isLoaded } = useSessionWork({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const overrides = useAppStore(
    useShallow((state) => agents.map((agent) => state.agentKindOverride[agent.id] ?? null)),
  );
  const waits = useAppStore(
    useShallow((state) => agents.map((agent) => state.agentWriterWait[agent.id] ?? null)),
  );
  const nounById = useMemo(
    () =>
      new Map<string, string>(
        agents.map((agent, index) => [
          agent.id,
          AGENT_KIND_META[classifyAgent({ agent, override: overrides[index] ?? null })].noun,
        ]),
      ),
    [agents, overrides],
  );
  const writerWaits = useMemo(
    () =>
      agents.flatMap((agent, index): ReadonlyArray<NowWriterWait> => {
        const wait = waits[index];
        if (wait === null || wait === undefined || wait.sessionId !== sessionId) {
          return [];
        }
        const since = Date.parse(wait.since);
        return [
          {
            agentId: agent.id,
            path: wait.blockedPath,
            blockedBy: wait.blockedBy,
            since: Number.isFinite(since) ? since : null,
          },
        ];
      }),
    [agents, sessionId, waits],
  );
  const model = useMemo(
    () => nowRowsOf({ groups, work, writerWaits, nounById }),
    [groups, nounById, work, writerWaits],
  );
  return { ...model, isLoaded };
};
