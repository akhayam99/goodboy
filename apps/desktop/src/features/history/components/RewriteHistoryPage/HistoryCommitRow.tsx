import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { Cloud, GitMergeConflict, GripVertical } from 'lucide-react';
import { Checkbox, Tooltip, cn } from '@goodboy/ui';
import type { BranchCommit, HistoryStep, HistoryStepPrediction } from '@goodboy/types';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { VERB_LINE } from '../../historyPlan';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly commit: BranchCommit;
  readonly step: HistoryStep;
  readonly prediction: HistoryStepPrediction | null;
  readonly isSelected: boolean;
  readonly isEditing: boolean;
  readonly editor: ReactNode;
  readonly verbControl: ReactNode;
  readonly onToggleSelect: () => void;
  readonly onStartReword: () => void;
  readonly onKey: (key: string, withAlt: boolean) => boolean;
  readonly isDragTarget: boolean;
  readonly onDragStart: () => void;
  readonly onDragEnter: () => void;
  readonly onDrop: () => void;
  readonly onDragEnd: () => void;
};

export const HistoryCommitRow = ({
  commit,
  step,
  prediction,
  isSelected,
  isEditing,
  editor,
  verbControl,
  onToggleSelect,
  onStartReword,
  onKey,
  isDragTarget,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: Props) => {
  const isDropped = step.verb === 'drop';
  const isConflict = prediction?.outcome === 'conflict';
  const isEmpty = prediction?.outcome === 'empty';
  const subject =
    step.message != null && step.message !== ''
      ? (step.message.split('\n')[0] ?? '')
      : commit.subject;
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (onKey(event.key, event.altKey)) {
      event.preventDefault();
    }
  };

  const onStart = (event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', commit.sha);
    onDragStart();
  };
  const onOver = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };
  const onDropHere = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    onDrop();
  };

  return (
    <li
      tabIndex={0}
      draggable
      onDragStart={onStart}
      onDragEnter={onDragEnter}
      onDragOver={onOver}
      onDrop={onDropHere}
      onDragEnd={onDragEnd}
      aria-label={`${commit.shortSha} ${subject}`}
      data-testid={`history-row-${commit.shortSha}`}
      onKeyDown={onKeyDown}
      className={cn(
        'group flex min-w-0 flex-col gap-1.5 rounded-md px-2 py-1.5 outline-none focus-visible:bg-hover hover:bg-hover',
        isSelected && 'bg-selected',
        isDragTarget && 'ring-1 ring-focus-ring',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <GripVertical
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0 cursor-grab text-faint-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        />
        <Checkbox
          checked={isSelected}
          onChange={onToggleSelect}
          aria-label={`Select ${commit.shortSha}`}
        />
        <span className="shrink-0 font-mono text-secondary tabular-nums text-muted-foreground">
          {commit.shortSha}
        </span>
        <button
          type="button"
          onClick={onStartReword}
          title={VERB_LINE.reword}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-row',
            isDropped ? 'text-faint-foreground line-through' : 'text-foreground',
          )}
        >
          {subject}
        </button>
        {commit.pushed ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
            <Cloud size={11} aria-hidden />
            on origin
          </span>
        ) : null}
        <span className="w-24 shrink-0 truncate text-meta text-faint-foreground">
          {commit.author}
        </span>
        <span className="w-10 shrink-0 text-right text-meta tabular-nums text-faint-foreground">
          {formatRelativeAge({
            fromIso: new Date(commit.timestamp * 1000).toISOString(),
            nowMs: Date.now(),
          })}
        </span>
        {isConflict ? (
          <Tooltip content={`Conflicts in ${prediction.files.join(', ')}`}>
            <span className="inline-flex shrink-0 items-center gap-1 text-label text-warning">
              <GitMergeConflict size={11} aria-hidden />
              Conflict
            </span>
          </Tooltip>
        ) : null}
        {isEmpty ? (
          <span
            className="shrink-0 text-meta text-muted-foreground"
            title="Its changes are already there. Drop it."
          >
            Already there
          </span>
        ) : null}
        {verbControl}
      </div>
      {isEditing ? <div className="pl-7">{editor}</div> : null}
    </li>
  );
};
