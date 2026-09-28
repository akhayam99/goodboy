import type { HistoryStep } from '@goodboy/types';
import { moveFacts, type MoveFact } from './historyEdits';
import { isFolded, messageOf, targetOf, type CombineMode } from './historyPlan';

export type HistoryRowAction = 'pick' | 'fixup' | 'squash' | 'move' | 'reword' | 'drop';

export type HistoryAction = HistoryRowAction | 'rebase';

export type HistoryTakenIn = {
  readonly sha: string;
  readonly mode: CombineMode;
};

export type HistoryRowMark = {
  readonly action: HistoryRowAction;
  readonly move: MoveFact | null;
  readonly into: { readonly target: string; readonly mode: CombineMode } | null;
  readonly takesIn: ReadonlyArray<HistoryTakenIn>;
  readonly takesInMode: CombineMode | null;
  readonly renamedTo: string | null;
  readonly isRemoved: boolean;
};

export const HISTORY_ACTION_TERM: Readonly<Record<HistoryAction, string>> = {
  pick: 'pick',
  fixup: 'fixup',
  squash: 'squash',
  move: 'reorder',
  reword: 'reword',
  drop: 'drop',
  rebase: 'rebase',
};

export const HISTORY_ACTION_LABEL: Readonly<Record<HistoryAction, string>> = {
  pick: 'Keep',
  fixup: 'Fold in, keep its title',
  squash: 'Combine, keep both messages',
  move: 'Move',
  reword: 'Rename',
  drop: 'Remove',
  rebase: "Start from today's main",
};

type Params = {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly original: ReadonlyArray<string>;
};

const actionOf = ({
  isRemoved,
  into,
  move,
  takesInMode,
  renamedTo,
}: Omit<HistoryRowMark, 'action' | 'takesIn'>): HistoryRowAction => {
  if (isRemoved) {
    return 'drop';
  }
  if (into !== null) {
    return into.mode;
  }
  if (move !== null) {
    return 'move';
  }
  if (takesInMode !== null) {
    return takesInMode;
  }
  return renamedTo === null ? 'pick' : 'reword';
};

export const historyRowMarks = ({
  items,
  original,
}: Params): ReadonlyMap<string, HistoryRowMark> => {
  const moves = moveFacts({ items, original });
  const takenIn = new Map<string, HistoryTakenIn[]>();
  for (const step of items) {
    const target = targetOf({ step });
    if (!isFolded({ step }) || target === null) {
      continue;
    }
    const list = takenIn.get(target) ?? [];
    list.push({ sha: step.sha, mode: step.verb === 'squash' ? 'squash' : 'fixup' });
    takenIn.set(target, list);
  }
  const marks = new Map<string, HistoryRowMark>();
  for (const step of items) {
    const target = targetOf({ step });
    const into =
      isFolded({ step }) && target !== null
        ? { target, mode: step.verb === 'squash' ? ('squash' as const) : ('fixup' as const) }
        : null;
    const takesIn = takenIn.get(step.sha) ?? [];
    const takesInMode =
      takesIn.length === 0
        ? null
        : takesIn.some((taken) => taken.mode === 'squash')
          ? 'squash'
          : 'fixup';
    const message = messageOf({ step });
    const parts = {
      move: moves.get(step.sha) ?? null,
      into,
      takesInMode,
      renamedTo:
        step.verb === 'reword' && message !== null ? (message.split('\n')[0] ?? message) : null,
      isRemoved: step.verb === 'drop',
    } satisfies Omit<HistoryRowMark, 'action' | 'takesIn'>;
    marks.set(step.sha, { ...parts, takesIn, action: actionOf(parts) });
  }
  return marks;
};

export const historyGroupOf = ({
  marks,
  sha,
}: {
  readonly marks: ReadonlyMap<string, HistoryRowMark>;
  readonly sha: string;
}): ReadonlyArray<string> => {
  const target = marks.get(sha)?.into?.target ?? sha;
  const takesIn = marks.get(target)?.takesIn ?? [];
  if (takesIn.length === 0) {
    return [sha];
  }
  return [target, ...takesIn.map((taken) => taken.sha)];
};
