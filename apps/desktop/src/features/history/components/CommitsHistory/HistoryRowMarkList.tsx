import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, GitMerge, Minus, PenLine } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { quoted } from '../../historyEditText';
import type { HistoryRowMark } from '../../historyRowMarks';
import { HistoryChangeMark } from './HistoryChangeMark';
import type { HistoryRowView } from './historyRowLine';

const moveLabel = ({ delta }: { readonly delta: number }): string =>
  `Moves ${delta < 0 ? 'up' : 'down'} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'place' : 'places'} (reorder)`;

export const HistoryRowMarkList = ({
  mark,
  view,
  isExpanded,
  titleOf,
  onToggleExpanded,
}: {
  readonly mark: HistoryRowMark;
  readonly view: HistoryRowView;
  readonly isExpanded: boolean;
  readonly titleOf: (sha: string) => string;
  readonly onToggleExpanded: () => void;
}) => {
  const marks: ReactNode[] = [];
  if (mark.move !== null) {
    const delta = mark.move.delta;
    marks.push(
      <HistoryChangeMark key="move" action="move" label={moveLabel({ delta })}>
        {delta < 0 ? (
          <ArrowUp size={ICON_SIZE.row} aria-hidden />
        ) : (
          <ArrowDown size={ICON_SIZE.row} aria-hidden />
        )}
        {Math.abs(delta)}
      </HistoryChangeMark>,
    );
  }
  if (mark.takesIn.length > 0 && mark.takesInMode !== null && mark.into === null) {
    const count = mark.takesIn.length;
    marks.push(
      <HistoryChangeMark
        key="takes-in"
        action={mark.takesInMode}
        label={`${mark.takesInMode === 'fixup' ? 'Folds in' : 'Combines'} ${count} ${count === 1 ? 'commit' : 'commits'}`}
        detail={mark.takesIn.map((taken) => quoted({ text: titleOf(taken.sha) })).join(', ')}
        isExpanded={isExpanded}
        onToggle={view === 'planned' ? onToggleExpanded : undefined}
      >
        +{count}
      </HistoryChangeMark>,
    );
  }
  if (mark.into !== null) {
    marks.push(
      <HistoryChangeMark
        key="into"
        action={mark.into.mode}
        label={
          mark.into.mode === 'fixup'
            ? `Folds into ${quoted({ text: titleOf(mark.into.target) })} (fixup)`
            : `Combines with ${quoted({ text: titleOf(mark.into.target) })} (squash)`
        }
        detail={
          mark.into.mode === 'fixup'
            ? "Only that commit's title is kept."
            : 'Both messages are kept.'
        }
      >
        <GitMerge size={ICON_SIZE.row} aria-hidden />
      </HistoryChangeMark>,
    );
  }
  if (mark.renamedTo !== null) {
    marks.push(
      <HistoryChangeMark
        key="rename"
        action="reword"
        label="Renamed on Apply (reword)"
        detail={`New name: ${quoted({ text: mark.renamedTo })}`}
      >
        <PenLine size={ICON_SIZE.row} aria-hidden />
      </HistoryChangeMark>,
    );
  }
  if (mark.isRemoved) {
    marks.push(
      <HistoryChangeMark key="remove" action="drop" label="Removed on Apply (drop)">
        <Minus size={ICON_SIZE.row} aria-hidden />
      </HistoryChangeMark>,
    );
  }
  return <>{marks.slice(0, 2)}</>;
};
