import type { TimelineTopLevelEntry } from './buildTimelineGroups';
import { segmentsToText, sessionEventLabel } from './sessionEventPresentation';
import { workEventLabel } from './workEventLabel';

const textOf = ({ entry }: { readonly entry: TimelineTopLevelEntry }): string => {
  switch (entry.kind) {
    case 'event':
      return segmentsToText({ segments: sessionEventLabel({ event: entry.event }) });
    case 'plan':
      return entry.plan.title;
    case 'artifact':
      return entry.artifact.title;
    case 'learning':
      return `${entry.item.title} ${entry.item.text}`;
    case 'question':
      return entry.questions.map((question) => question.text).join(' ');
    case 'issue':
      return `${entry.task.identifier} ${entry.task.title}`;
    case 'branch':
      return entry.worktree.branch;
    case 'work':
      return segmentsToText({ segments: workEventLabel({ entry }) });
    case 'run':
      return entry.run.title ?? entry.workflow.name;
    case 'agent':
      return entry.agent.name;
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
};

export const logEntriesMatching = ({
  entries,
  query,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly query: string;
}): ReadonlyArray<TimelineTopLevelEntry> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return entries;
  }
  return entries.filter((entry) => textOf({ entry }).toLowerCase().includes(needle));
};
