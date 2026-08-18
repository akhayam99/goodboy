import type { Agent } from '@goodboy/types';

export type AgentCreation = {
  readonly at: string | null;
  readonly ordinal: number;
  readonly isRecorded: boolean;
};

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

type EvidenceParams = {
  readonly agent: Agent;
};

const earliestEvidence = ({ agent }: EvidenceParams): string | null => {
  const known: ReadonlyArray<string> = [agent.startedAt, agent.completedAt].filter(
    (value): value is NonNullable<typeof value> => value != null,
  );
  const first = known[0];
  if (first === undefined) {
    return null;
  }
  return known.reduce((earliest, value) => (value < earliest ? value : earliest), first);
};

type ClampParams = {
  readonly evidence: string | null;
  readonly ceiling: string | null;
};

const clampToCeiling = ({ evidence, ceiling }: ClampParams): string | null => {
  if (evidence == null) {
    return ceiling;
  }
  if (ceiling == null) {
    return evidence;
  }
  return ceiling < evidence ? ceiling : evidence;
};

export const resolveAgentCreation = ({ agents }: Params): ReadonlyMap<string, AgentCreation> => {
  const byOrdinal = [...agents].sort(
    (first, second) => first.ordinal - second.ordinal || first.id.localeCompare(second.id),
  );
  const creations = new Map<string, AgentCreation>();
  let ceiling: string | null = null;

  for (let index = byOrdinal.length - 1; index >= 0; index -= 1) {
    const agent = byOrdinal[index];
    if (agent === undefined) {
      continue;
    }
    const evidence = earliestEvidence({ agent });
    const clamped = clampToCeiling({ evidence, ceiling });
    creations.set(agent.id, {
      at: clamped,
      ordinal: agent.ordinal,
      isRecorded: evidence != null,
    });
    if (clamped != null) {
      ceiling = clamped;
    }
  }

  return creations;
};
