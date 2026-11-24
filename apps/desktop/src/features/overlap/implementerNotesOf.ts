import type { Agent } from '@goodboy/types';
import type { ImplementerNote } from './messageImplementers';
import type { MergeStep, OverlapGroup } from './overlapGroupOf';

const LISTED_PATHS = 10;

type Params = {
  readonly group: OverlapGroup;
  readonly implementers: ReadonlyArray<Agent | null>;
};

type ListParams = {
  readonly words: ReadonlyArray<string>;
};

type NoteParams = {
  readonly step: MergeStep;
  readonly agent: Agent;
};

const listOf = ({ words }: ListParams): string => {
  const last = words.at(-1) ?? '';
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${last}` : last;
};

export const implementerNotesOf = ({
  group,
  implementers,
}: Params): ReadonlyArray<ImplementerNote> => {
  const order = group.steps.map((step) => step.mount.branch).join(', then ');
  const noteOf = ({ step, agent }: NoteParams): ImplementerNote => {
    const partners = group.steps.filter((other) => (step.isOwn ? !other.isOwn : other.isOwn));
    const listed = step.sharedPaths.slice(0, LISTED_PATHS).join(', ');
    const more = step.sharedPaths.length - LISTED_PATHS;
    const files = more > 0 ? `${listed} and ${more} more` : listed;
    const branches = listOf({ words: partners.map((other) => other.mount.branch) });
    return {
      sessionId: agent.sessionId,
      agentId: agent.id,
      content: `Your branch ${step.mount.branch} changes the same files as ${branches}: ${files}. Proposed merge order: ${order}.`,
    };
  };
  return group.steps.flatMap((step, index) => {
    const agent = implementers[index] ?? null;
    return agent === null ? [] : [noteOf({ step, agent })];
  });
};
