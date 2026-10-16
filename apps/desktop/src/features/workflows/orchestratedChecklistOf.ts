import type { Agent, AgentId, AgentRole, OrchestratorHint } from '@goodboy/types';

type Summary = {
  readonly done: ReadonlyArray<string>;
  readonly left: ReadonlyArray<string>;
  readonly leftRoles: Readonly<Partial<Record<string, AgentRole>>>;
};

export type OrchestratedPlannedItem = {
  readonly text: string;
  readonly role: AgentRole | null;
};

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly summary: Summary | null;
  readonly isDeciding: boolean;
  readonly isDone: boolean;
};

export type OrchestratedChecklist = {
  readonly readHintsBefore: ReadonlyMap<AgentId, ReadonlyArray<number>>;
  readonly trailingHintSteps: ReadonlyArray<number>;
  readonly left: ReadonlyArray<OrchestratedPlannedItem>;
  readonly isNextShown: boolean;
};

export const orchestratedChecklistOf = ({
  agents,
  hints,
  summary,
  isDeciding,
  isDone,
}: Params): OrchestratedChecklist => {
  const roots = agents
    .filter((agent) => agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const readSteps = [
    ...new Set(
      hints.flatMap((hint) =>
        hint.consumedAt != null && hint.consumedAtStep != null ? [hint.consumedAtStep] : [],
      ),
    ),
  ].sort((left, right) => left - right);
  const readHintsBefore = new Map<AgentId, ReadonlyArray<number>>();
  const trailingHintSteps: Array<number> = [];
  for (const step of readSteps) {
    const root = roots[step - 1];
    if (root === undefined) {
      trailingHintSteps.push(step);
      continue;
    }
    readHintsBefore.set(root.id, [...(readHintsBefore.get(root.id) ?? []), step]);
  }
  return {
    readHintsBefore,
    trailingHintSteps,
    left:
      isDone || summary === null
        ? []
        : summary.left.map((text) => ({ text, role: summary.leftRoles[text] ?? null })),
    isNextShown: isDeciding,
  };
};
