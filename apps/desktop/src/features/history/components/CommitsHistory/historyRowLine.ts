import { quoted } from '../../historyEditText';
import type { HistoryAction, HistoryRowMark } from '../../historyRowMarks';

export type HistoryRowView = 'now' | 'planned' | 'done';

export type HistoryRowLinePart = {
  readonly key: string;
  readonly action: HistoryAction | null;
  readonly text: string;
};

type Params = {
  readonly mark: HistoryRowMark | null;
  readonly view: HistoryRowView;
  readonly title: string;
  readonly titleOf: (sha: string) => string;
  readonly includes: ReadonlyArray<string>;
  readonly isExpanded: boolean;
};

const more = ({ count }: { readonly count: number }): string =>
  count > 1 ? ` and ${count - 1} more` : '';

export const historyRowLine = ({
  mark,
  view,
  title,
  titleOf,
  includes,
  isExpanded,
}: Params): ReadonlyArray<HistoryRowLinePart> => {
  if (view === 'done' || mark === null) {
    const first = includes[0];
    return first === undefined
      ? []
      : [
          {
            key: 'includes',
            action: null,
            text: `includes ${quoted({ text: first })}${more({ count: includes.length })}`,
          },
        ];
  }
  const parts: HistoryRowLinePart[] = [];
  const isNow = view === 'now';
  if (mark.move !== null) {
    const relation = mark.move.relation;
    const where =
      relation.where === 'bottom'
        ? 'to the bottom'
        : `${relation.where} ${quoted({ text: titleOf(relation.sha) })}`;
    parts.push({ key: 'move', action: 'move', text: `${isNow ? 'moves' : 'moved'} ${where}` });
  }
  const firstTaken = mark.takesIn[0];
  if (
    firstTaken !== undefined &&
    mark.takesInMode !== null &&
    !(view === 'planned' && isExpanded)
  ) {
    parts.push({
      key: 'takes-in',
      action: mark.takesInMode,
      text: `${isNow ? 'takes in' : 'includes'} ${quoted({ text: titleOf(firstTaken.sha) })}${more({ count: mark.takesIn.length })}`,
    });
  }
  if (mark.into !== null) {
    const target = quoted({ text: titleOf(mark.into.target) });
    parts.push({
      key: 'into',
      action: mark.into.mode,
      text:
        mark.into.mode === 'fixup'
          ? `folds into ${target}, keeps that title`
          : `combines with ${target}, keeps both messages`,
    });
  }
  if (mark.renamedTo !== null) {
    parts.push({
      key: 'rename',
      action: 'reword',
      text: isNow
        ? `becomes ${quoted({ text: mark.renamedTo })}`
        : `renamed from ${quoted({ text: title })}`,
    });
  }
  if (mark.isRemoved) {
    parts.push({ key: 'remove', action: 'drop', text: 'removed on Apply' });
  }
  return parts;
};
