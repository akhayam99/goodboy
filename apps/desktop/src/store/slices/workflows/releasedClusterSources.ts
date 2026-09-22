import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type ReleasedSourceIdsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly children: ReadonlyArray<Agent>;
  readonly resolvingHoldId: string | null;
};

export const releasedSourceIds = ({
  get,
  sessionId,
  containerId,
  children,
  resolvingHoldId,
}: ReleasedSourceIdsParams): ReadonlySet<AgentId> => {
  const childIds = new Set(children.map((child) => child.id));
  return new Set(
    (get().clusterCompletionHolds?.[sessionId] ?? [])
      .filter(
        (hold) =>
          hold.containerAgentId === containerId &&
          childIds.has(hold.sourceAgentId) === false &&
          (hold.state === 'resolved' || hold.id === resolvingHoldId),
      )
      .map((hold) => hold.sourceAgentId),
  );
};
