import type { Agent, AgentId, AgentRole, OrchestratorHint } from '@goodboy/types';
import { isSameIntent } from './isSameIntent';

type Summary = {
  readonly done: ReadonlyArray<string>;
  readonly left: ReadonlyArray<string>;
  readonly leftRoles: Readonly<Partial<Record<string, AgentRole>>>;
};

type OrchestratedPlannedItem = {
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
  readonly notes: ReadonlyArray<string>;
  readonly isNextShown: boolean;
};

type OpenItems = Pick<OrchestratedChecklist, 'left' | 'notes'>;

type OpenItemsParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly summary: Summary;
};

const openItemsOf = ({ agents, summary }: OpenItemsParams): OpenItems => {
  const seen: Array<string> = agents.map((agent) => agent.name);
  const left: Array<OrchestratedPlannedItem> = [];
  const notes: Array<string> = [];
  for (const text of summary.left) {
    if (seen.some((known) => isSameIntent({ left: known, right: text }))) {
      continue;
    }
    seen.push(text);
    const role = summary.leftRoles[text] ?? null;
    if (role === null) {
      notes.push(text);
      continue;
    }
    left.push({ text, role });
  }
  return { left, notes };
};

const NO_OPEN_ITEMS: OpenItems = { left: [], notes: [] };

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
  const open = isDone || summary === null ? NO_OPEN_ITEMS : openItemsOf({ agents, summary });
  return {
    readHintsBefore,
    trailingHintSteps,
    left: open.left,
    notes: open.notes,
    isNextShown: isDeciding,
  };
};
