import type { TimelineStreamItem } from './buildTimelineStream';

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
};

export const shownQuestionIds = ({ items }: Params): ReadonlySet<string> => {
  const shown = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'row') {
      continue;
    }
    const { entry, rowState } = item;
    if (entry.kind === 'question') {
      for (const question of entry.questions) {
        if (question.status === 'open') {
          shown.add(question.id);
        }
      }
      continue;
    }
    if (entry.kind === 'agent' && rowState.reason?.kind === 'question') {
      for (const question of entry.openQuestions) {
        shown.add(question.id);
      }
      continue;
    }
    if (rowState.ask?.kind === 'answer' && rowState.ask.question != null) {
      shown.add(rowState.ask.question.id);
    }
  }
  return shown;
};
