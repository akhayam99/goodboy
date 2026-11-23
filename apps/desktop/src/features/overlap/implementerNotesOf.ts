import type { Agent } from '@goodboy/types';
import { mergeOrderOf } from './mergeOrderOf';
import type { ImplementerNote } from './messageBothImplementers';
import type { Overlap } from './overlapsOf';
import type { LiveMount } from './readLiveMounts';

const LISTED_PATHS = 10;

type Params = {
  readonly overlap: Overlap;
  readonly mountAgent: Agent | null;
  readonly otherAgent: Agent | null;
};

type NoteParams = {
  readonly agent: Agent;
  readonly other: LiveMount;
};

export const implementerNotesOf = ({
  overlap,
  mountAgent,
  otherAgent,
}: Params): ReadonlyArray<ImplementerNote> | null => {
  if (mountAgent === null || otherAgent === null) {
    return null;
  }
  const order = mergeOrderOf({ overlap });
  const listed = overlap.paths.slice(0, LISTED_PATHS).join(', ');
  const more = overlap.paths.length - LISTED_PATHS;
  const files = more > 0 ? `${listed} and ${more} more` : listed;
  const noteOf = ({ agent, other }: NoteParams): ImplementerNote => ({
    sessionId: agent.sessionId,
    agentId: agent.id,
    content: `Another session changes the same files on branch ${other.branch}: ${files}. Proposed merge order: ${order.first.branch}, then ${order.then.branch}.`,
  });
  return [
    noteOf({ agent: mountAgent, other: overlap.other }),
    noteOf({ agent: otherAgent, other: overlap.mount }),
  ];
};
