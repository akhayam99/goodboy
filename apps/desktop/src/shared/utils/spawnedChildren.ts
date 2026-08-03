import type { Agent, AgentId, AgentStatus, TurnState } from '@goodboy/types';

export type SpawnAssignment = Readonly<{
  name: string;
  text: string;
}>;

export type SpawnedChild = Readonly<{
  agent: Agent;
  index: number;
  total: number;
  status: AgentStatus;
  assignment: string | null;
}>;

type Params = {
  readonly runs: ReadonlyArray<Agent>;
  readonly parentAgentId: AgentId | null;
  readonly turnStates: Readonly<Record<string, TurnState | undefined>>;
  readonly assignments?: ReadonlyArray<SpawnAssignment>;
};

const normalize = (value: string): string => value.trim().toLowerCase();

const liveStatus = ({
  agent,
  turnStates,
}: {
  readonly agent: Agent;
  readonly turnStates: Readonly<Record<string, TurnState | undefined>>;
}): AgentStatus => {
  if (agent.status !== 'running' && turnStates[agent.id]?.kind === 'running') {
    return 'running';
  }
  return agent.status;
};

export const selectSpawnedChildren = ({
  runs,
  parentAgentId,
  turnStates,
  assignments = [],
}: Params): ReadonlyArray<SpawnedChild> => {
  if (parentAgentId == null) {
    return [];
  }
  const children = runs
    .filter((run) => run.parentAgentId === parentAgentId)
    .sort((first, second) => first.ordinal - second.ordinal);
  if (children.length === 0) {
    return [];
  }
  const byName = new Map(
    assignments.map((assignment) => [normalize(assignment.name), assignment.text]),
  );
  const total = children.length;
  return children.map((agent, index) => {
    const matched = byName.get(normalize(agent.name)) ?? assignments[index]?.text ?? '';
    const assignment = matched.trim();
    return {
      agent,
      index,
      total,
      status: liveStatus({ agent, turnStates }),
      assignment: assignment === '' ? null : assignment,
    };
  });
};
