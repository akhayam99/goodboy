import type { AgentId, AgentStatus, MountId } from '@goodboy/types';

export type WakeCandidate = {
  readonly id: AgentId;
  readonly kind: string;
  readonly status: AgentStatus;
  readonly ordinal: number;
  readonly mountId: MountId | null;
  readonly isDeleted: boolean;
};

type Params = {
  readonly agents: ReadonlyArray<WakeCandidate>;
  readonly mountId: MountId;
};

const UNREACHABLE: ReadonlyArray<AgentStatus> = ['stopped', 'failed', 'skipped'];

export const wakeImplementerOf = ({ agents, mountId }: Params): AgentId | null => {
  const candidates = agents
    .filter(
      (agent) =>
        agent.kind === 'implementer' &&
        !agent.isDeleted &&
        !UNREACHABLE.includes(agent.status) &&
        (agent.mountId === null || agent.mountId === mountId),
    )
    .sort((first, second) => {
      const ownGap = Number(second.mountId === mountId) - Number(first.mountId === mountId);
      return ownGap !== 0 ? ownGap : second.ordinal - first.ordinal;
    });
  return candidates[0]?.id ?? null;
};
