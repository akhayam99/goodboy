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
  readonly readHintsBefore: ReadonlyMap<AgentId, ReadonlyArray<OrchestratorHint>>;
  readonly trailingHints: ReadonlyArray<OrchestratorHint>;
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
  const readHints = hints
    .filter((hint) => hint.consumedAt != null)
    .sort((left, right) => {
      const stepGap =
        (left.consumedAtStep ?? Number.MAX_SAFE_INTEGER) -
        (right.consumedAtStep ?? Number.MAX_SAFE_INTEGER);
      return stepGap === 0
        ? (left.consumedAt ?? '').localeCompare(right.consumedAt ?? '')
        : stepGap;
    });
  const readHintsBefore = new Map<AgentId, ReadonlyArray<OrchestratorHint>>();
  const trailingHints: Array<OrchestratorHint> = [];
  for (const hint of readHints) {
    const root = hint.consumedAtStep == null ? undefined : roots[hint.consumedAtStep - 1];
    if (root === undefined) {
      trailingHints.push(hint);
      continue;
    }
    readHintsBefore.set(root.id, [...(readHintsBefore.get(root.id) ?? []), hint]);
  }
  const open = isDone || summary === null ? NO_OPEN_ITEMS : openItemsOf({ agents, summary });
  return {
    readHintsBefore,
    trailingHints,
    left: open.left,
    notes: open.notes,
    isNextShown: isDeciding,
  };
};
