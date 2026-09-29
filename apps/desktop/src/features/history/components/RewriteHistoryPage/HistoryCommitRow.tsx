import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Cloud, GitMerge, GripVertical } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { BranchCommit, SessionId } from '@goodboy/types';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { CombineMode } from '../../historyPlan';
import {
  HISTORY_ACTION_LABEL,
  type HistoryAction,
  type HistoryRowMark,
} from '../../historyRowMarks';
import { HistoryModeSwitch } from './HistoryModeSwitch';
import { HistoryRowActions } from './HistoryRowActions';
import { HistoryRowMarkList } from './HistoryRowMarkList';
import { HistoryRowPills, type HistoryRowPillState } from './HistoryRowPills';
import { HistoryRowPlanLine } from './HistoryRowPlanLine';
import { historyRowLine, type HistoryRowView } from './historyRowLine';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { CommitActionTarget } from '../../../actions/types';
import { useHeldPaletteScope } from '../../../palette/useHeldPaletteScope';

export type HistoryTakenInRow = {
  readonly commit: BranchCommit;
  readonly mode: CombineMode;
};

type Props = {
  readonly sessionId: SessionId;
  readonly commit: BranchCommit;
  readonly view: HistoryRowView;
  readonly mark: HistoryRowMark | null;
  readonly titleOf: (sha: string) => string;
  readonly conflictFiles: ReadonlyArray<string>;
  readonly includes: ReadonlyArray<string>;
  readonly takenIn: ReadonlyArray<HistoryTakenInRow>;
  readonly pills: HistoryRowPillState;
  readonly isNew: boolean;
  readonly isHighlighted: boolean;
  readonly isLifted: boolean;
  readonly isDropInto: boolean;
  readonly arrival: { readonly nonce: number; readonly action: HistoryAction } | null;
  readonly isInteractive: boolean;
  readonly isEditing: boolean;
  readonly isExpanded: boolean;
  readonly editor: ReactNode;
  readonly nowMs: number;
  readonly target: CommitActionTarget | null;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onHover: (isOver: boolean) => void;
  readonly onSeparate: (sha: string) => void;
  readonly onModeChange: (sha: string, mode: CombineMode) => void;
  readonly onToggleExpanded: () => void;
};

export const HistoryCommitRow = ({
  sessionId,
  commit,
  view,
  mark,
  titleOf,
  conflictFiles,
  includes,
  takenIn,
  pills,
  isNew,
  isHighlighted,
  isLifted,
  isDropInto,
  arrival,
  isInteractive,
  isEditing,
  isExpanded,
  editor,
  nowMs,
  target,
  onPointerDown,
  onHover,
  onSeparate,
  onModeChange,
  onToggleExpanded,
}: Props) => {
  const action = mark?.action ?? 'pick';
  const isFolded = mark?.into != null;
  const isRemoved = mark?.isRemoved === true;
  const title = view !== 'now' && mark?.renamedTo != null ? mark.renamedTo : commit.subject;
  const parts = historyRowLine({
    mark,
    view,
    title: commit.subject,
    titleOf,
    includes,
    isExpanded,
  });
  const isDraggable = isInteractive && !isFolded;
  const age = formatAge({
    from: new Date(commit.timestamp * 1000).toISOString(),
    now: nowMs,
  });
  const showExpanded = view === 'planned' && isExpanded && takenIn.length > 0;
  const anchorKey = `commit:${commit.sha}`;
  const menu = useObjectMenuTrigger({ target, anchorKey });
  const rowRef = useHeldPaletteScope<HTMLDivElement>({
    scope: target === null ? null : { ...target, sessionId },
  });
  return (
    <div
      ref={rowRef}
      role="listitem"
      tabIndex={isInteractive ? 0 : undefined}
      data-history-row={commit.sha}
      data-graph-key={commit.sha}
      data-flip-key={commit.sha}
      data-action={action}
      data-highlighted={isHighlighted ? 'true' : undefined}
      aria-label={`${title}${action === 'pick' ? '' : `, ${HISTORY_ACTION_LABEL[action]}`}`}
      onPointerDown={onPointerDown}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onContextMenu={menu.onContextMenu}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget) {
          menu.onKeyDown(event);
        }
      }}
      className="group relative grid min-h-14 grid-cols-[100px_48px_minmax(0,1fr)] items-start outline-none"
    >
      <span aria-hidden />
      <span className="flex h-14 flex-col items-end justify-center gap-1 pr-2.5">
        {mark === null ? null : (
          <HistoryRowMarkList
            mark={mark}
            view={view}
            isExpanded={isExpanded}
            titleOf={titleOf}
            onToggleExpanded={onToggleExpanded}
          />
        )}
      </span>
      <span
        className={cn(
          'relative flex min-h-14 min-w-0 items-start gap-2.5 rounded-lg py-2 pl-2 pr-2.5 transition-colors select-none',
          isDraggable && 'cursor-grab',
          'group-hover:bg-hover group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-focus-ring',
          isHighlighted && 'bg-selected',
          isLifted && 'opacity-30 outline-1 outline-dashed outline-border',
          isDropInto &&
            cn('ring-2 ring-inset ring-history-fixup', HISTORY_ACTION_CLASSES.fixup.wash),
        )}
      >
        {action === 'pick' ? null : (
          <span
            aria-hidden
            className={cn(
              'absolute bottom-3 left-0 top-3 w-0.5 rounded-full',
              HISTORY_ACTION_CLASSES[action].solid,
            )}
          />
        )}
        {arrival === null ? null : (
          <span
            key={arrival.nonce}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 hidden rounded-lg motion-safe:block motion-safe:animate-history-arrive',
              HISTORY_ACTION_CLASSES[arrival.action].wash,
            )}
          />
        )}
        {isInteractive ? (
          <GripVertical
            size={ICON_SIZE.control}
            aria-hidden
            className={cn(
              'mt-0.5 shrink-0 text-faint-foreground opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
              !isDraggable && 'invisible',
            )}
          />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          {isEditing ? (
            editor
          ) : (
            <>
              <span className="flex min-w-0 items-start gap-2">
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-row',
                    isRemoved
                      ? 'text-faint-foreground line-through decoration-danger'
                      : isFolded && view === 'now'
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                  )}
                >
                  {title}
                </span>
                <HistoryRowPills {...pills} />
                {isFolded && view === 'now' && isInteractive && mark?.into != null ? (
                  <HistoryModeSwitch
                    mode={mark.into.mode}
                    onChange={(mode) => onModeChange(commit.sha, mode)}
                    onSeparate={() => onSeparate(commit.sha)}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  'flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-secondary text-faint-foreground',
                  isRemoved && 'opacity-70',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 font-mono tabular-nums',
                    isNew ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {commit.shortSha}
                </span>
                <span className="truncate">{commit.author}</span>
                <span className="shrink-0">{age}</span>
                {commit.pushed && view !== 'done' ? (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Cloud size={ICON_SIZE.row} aria-hidden />
                    online
                  </span>
                ) : null}
              </span>
              <HistoryRowPlanLine parts={parts} conflictFiles={conflictFiles} />
              {showExpanded ? (
                <span className="mt-1.5 flex flex-col gap-0.5 border-l border-border-soft pl-2.5">
                  {takenIn.map((taken) => (
                    <span
                      key={taken.commit.sha}
                      className="flex min-w-0 items-center gap-2 text-label text-muted-foreground"
                    >
                      <GitMerge size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                      <span className="truncate text-foreground">{taken.commit.subject}</span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {taken.commit.shortSha}
                      </span>
                      {isInteractive ? (
                        <HistoryModeSwitch
                          mode={taken.mode}
                          onChange={(mode) => onModeChange(taken.commit.sha, mode)}
                          onSeparate={() => onSeparate(taken.commit.sha)}
                        />
                      ) : null}
                    </span>
                  ))}
                </span>
              ) : null}
            </>
          )}
        </span>
        {target !== null && !isEditing ? (
          <HistoryRowActions target={target} anchorKey={anchorKey} />
        ) : null}
      </span>
    </div>
  );
};
