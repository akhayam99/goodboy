import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Minus,
  PenLine,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { HistoryEdit } from '../../historyEdits';
import { HISTORY_ACTION_TERM } from '../../historyRowMarks';
import type { CombineMode } from '../../historyPlan';
import { HistoryChangeMark } from './HistoryChangeMark';
import { HistoryModeSwitch } from './HistoryModeSwitch';

type Props = {
  readonly edit: HistoryEdit;
  readonly text: string;
  readonly conflict: string | null;
  readonly isHighlighted: boolean;
  readonly isInteractive: boolean;
  readonly onUndo: () => void;
  readonly onHover: (isOver: boolean) => void;
  readonly onModeChange: (mode: CombineMode) => void;
};

const glyphOf = ({ edit }: { readonly edit: HistoryEdit }): ReactNode => {
  switch (edit.kind) {
    case 'move': {
      const delta = edit.move.delta;
      if (delta === 0) {
        return <ArrowUpDown size={ICON_SIZE.row} aria-hidden />;
      }
      return (
        <>
          {delta < 0 ? (
            <ArrowUp size={ICON_SIZE.row} aria-hidden />
          ) : (
            <ArrowDown size={ICON_SIZE.row} aria-hidden />
          )}
          {Math.abs(delta)}
        </>
      );
    }
    case 'fixup':
    case 'squash':
      return '+1';
    case 'reword':
      return <PenLine size={ICON_SIZE.row} aria-hidden />;
    case 'drop':
      return <Minus size={ICON_SIZE.row} aria-hidden />;
    case 'rebase':
      return (
        <>
          <ArrowUp size={ICON_SIZE.row} aria-hidden />
          {edit.count}
        </>
      );
    default: {
      const exhaustive: never = edit;
      return exhaustive;
    }
  }
};

export const HistoryEditRow = ({
  edit,
  text,
  conflict,
  isHighlighted,
  isInteractive,
  onUndo,
  onHover,
  onModeChange,
}: Props) => (
  <li
    data-edit={edit.key}
    data-highlighted={isHighlighted ? 'true' : undefined}
    onPointerEnter={() => onHover(true)}
    onPointerLeave={() => onHover(false)}
    className={cn(
      'flex min-h-9 min-w-0 items-center gap-3 rounded-md px-2 py-1 transition-colors',
      isHighlighted && 'bg-selected',
    )}
  >
    <HistoryChangeMark action={edit.kind} label={text}>
      {glyphOf({ edit })}
    </HistoryChangeMark>
    <span className="min-w-0 flex-1 truncate text-body text-foreground" title={text}>
      {text}
    </span>
    {conflict === null ? null : (
      <span
        title={conflict}
        className="inline-flex shrink-0 items-center gap-1 text-label text-warning"
      >
        <TriangleAlert size={ICON_SIZE.row} aria-hidden />
        may conflict
      </span>
    )}
    {edit.kind === 'fixup' || edit.kind === 'squash' ? (
      <HistoryModeSwitch mode={edit.kind} isDisabled={!isInteractive} onChange={onModeChange} />
    ) : null}
    <span className="w-14 shrink-0 text-right font-mono text-meta text-faint-foreground">
      {HISTORY_ACTION_TERM[edit.kind]}
    </span>
    {isInteractive ? (
      <Button size="sm" variant="ghost" aria-label={`Undo: ${text}`} onClick={onUndo}>
        <Undo2 size={ICON_SIZE.row} aria-hidden />
        Undo
      </Button>
    ) : null}
  </li>
);
