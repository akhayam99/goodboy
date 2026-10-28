import type { DemoChapter } from '../demoChapters';
import type { HintProgress } from './hintProgressTypes';
import { stepsOf } from './stepsOf';

export type GroupAccess = 'done' | 'open' | 'locked';

export type Access = {
  readonly groups: ReadonlyMap<string, GroupAccess>;
  readonly closing: GroupAccess;
};

type Params = {
  readonly chapters: ReadonlyArray<DemoChapter>;
  readonly progress: HintProgress;
};

export const groupAccessOf = ({ chapters, progress }: Params): Access => {
  const groups = new Map<string, GroupAccess>();
  let isBlocked = false;
  for (const chapter of chapters) {
    if (stepsOf({ chapter, progress }).isDone) {
      groups.set(chapter.id, 'done');
      continue;
    }
    groups.set(chapter.id, isBlocked ? 'locked' : 'open');
    isBlocked = true;
  }
  return { groups, closing: isBlocked ? 'locked' : 'open' };
};
