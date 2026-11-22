import type { Agent } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly mountId: string;
};

const PARKED: ReadonlySet<Agent['status']> = new Set(['stopped', 'skipped']);

export const implementerOf = ({ agents, mountId }: Params): Agent | null =>
  agents
    .filter(
      (agent) =>
        agent.kind === 'implementer' &&
        agent.mountId === mountId &&
        agent.deletedAt === undefined &&
        !PARKED.has(agent.status),
    )
    .reduce<Agent | null>(
      (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
      null,
    );
