import { memo, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { cn, ICON_SIZE } from '@goodboy/ui';
import type { BranchCommit, SessionId } from '@goodboy/types';
import { formatAge } from '../../../../shared/utils/time/formatAge';

import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { CombineMode } from '../../historyPlan';
import {
  HISTORY_ACTION_LABEL,
  type HistoryAction,
  type HistoryRowMark,
} from '../../historyRowMarks';
import type { HistoryAbsorbed } from '../../../../store/slices/history/types';
import { HistoryCommitMetadata } from './HistoryCommitMetadata';
import { HistoryTakenInList } from './HistoryTakenInList';
import { HistoryAbsorbedList } from './HistoryAbsorbedList';
import { HistoryModeSwitch } from './HistoryModeSwitch';
import { HistoryRowActions } from './HistoryRowActions';
import { HistoryRowMarkList } from './HistoryRowMarkList';
import { HistoryRowPills, type HistoryRowPillState } from './HistoryRowPills';
import { HistoryRowPlanLine } from './HistoryRowPlanLine';
import { historyRowLine, type HistoryRowView } from './historyRowLine';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { CommitActionTarget } from '../../../actions/types';
import { useHeldPaletteScope } from '../../../palette/useHeldPaletteScope';
import { isSameData } from '../../../../shared/utils/isSameData';

type HistoryTakenInRow = {
  readonly commit: BranchCommit;
  readonly mode: CombineMode;
};

type Props = {
  readonly sessionId: SessionId;
  readonly commit: BranchCommit;
  readonly configuredAuthor?: string | null;
  readonly view: HistoryRowView;
  readonly mark: HistoryRowMark | null;
  readonly titleOf: (sha: string) => string;
  readonly conflictFiles: ReadonlyArray<string>;
  readonly includes: ReadonlyArray<string>;
  readonly absorbed: ReadonlyArray<HistoryAbsorbed>;
  readonly takenIn: ReadonlyArray<HistoryTakenInRow>;
  readonly pills: HistoryRowPillState;
  readonly isNew: boolean;
  readonly canShowUnpushed: boolean;
  readonly isHighlighted: boolean;
  readonly isLifted: boolean;
  readonly isDropInto: boolean;
  readonly arrival: { readonly nonce: number; readonly action: HistoryAction } | null;
  readonly isInteractive: boolean;
  readonly isEditing: boolean;
  readonly isBusy?: boolean;
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

const HistoryCommitRowView = ({
  sessionId,
  commit,
  configuredAuthor = null,
  view,
  mark,
  titleOf,
  conflictFiles,
  includes,
  absorbed,
  takenIn,
  pills,
  isNew,
  canShowUnpushed,
  isHighlighted,
  isLifted,
  isDropInto,
  arrival,
  isInteractive,
  isEditing,
  isBusy = false,
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
  const isTall =
    isEditing ||
    isBusy ||
    action !== 'pick' ||
    parts.length > 0 ||
    conflictFiles.length > 0 ||
    absorbed.length > 0 ||
    showExpanded;
  const anchorKey = `commit:${commit.sha}`;
  const menu = useObjectMenuTrigger({ target, anchorKey });
  const rowRef = useHeldPaletteScope<HTMLDivElement>({
    scope: target === null ? null : { ...target, sessionId },
  });
  return (
    <div
      ref={rowRef}
      role="listitem"
      aria-busy={isBusy ? true : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      data-history-row={commit.sha}
      data-graph-key={commit.sha}
      data-flip-key={commit.sha}
      data-action={action}
      data-history-density={isTall ? 'expanded' : 'compact'}
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
      className={cn(
        'group group/row relative grid min-h-7 grid-cols-[36px_minmax(0,1fr)] items-start outline-none',
        isTall && 'min-h-14',
      )}
    >
      <span aria-hidden />
      <span
        className={cn(
          'relative flex min-h-7 min-w-0 items-start gap-2 rounded-lg px-2 transition-colors select-none',
          isTall && 'min-h-14 pb-2',
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
              'absolute bottom-2 left-1 top-2 w-0.5 rounded-full',
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
              'self-start translate-y-1.5 shrink-0 text-faint-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
              !isDraggable && 'invisible',
            )}
          />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {isBusy ? (
            <span role="status" className="text-meta text-muted-foreground text-shimmer">
              Editing commit
            </span>
          ) : null}
          {isEditing ? (
            <span className="flex min-h-7 flex-col">{editor}</span>
          ) : (
            <>
              <span
                className={cn('flex min-h-7 min-w-0 items-center gap-2', isTall && 'flex-wrap')}
              >
                <span
                  className={cn('flex min-h-7 min-w-0 flex-1 items-center', isTall && 'basis-full')}
                >
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
                </span>
                <HistoryCommitMetadata
                  commit={commit}
                  configuredAuthor={configuredAuthor}
                  age={age}
                  isRemoved={isRemoved}
                  isNew={isNew}
                  shaClassName="font-mono"
                  canShowUnpushed={canShowUnpushed}
                  view={view}
                />
                {mark === null ? null : (
                  <span className="flex shrink-0 items-center gap-1">
                    <HistoryRowMarkList
                      mark={mark}
                      view={view}
                      isExpanded={isExpanded}
                      titleOf={titleOf}
                      onToggleExpanded={onToggleExpanded}
                    />
                  </span>
                )}
                <HistoryRowPills {...pills} />
                {isFolded && view === 'now' && isInteractive && mark?.into != null ? (
                  <HistoryModeSwitch
                    mode={mark.into.mode}
                    onChange={(mode) => onModeChange(commit.sha, mode)}
                    onSeparate={() => onSeparate(commit.sha)}
                  />
                ) : null}
              </span>
              {parts.length > 0 || conflictFiles.length > 0 ? (
                <HistoryRowPlanLine parts={parts} conflictFiles={conflictFiles} />
              ) : null}
              {absorbed.length === 0 ? null : <HistoryAbsorbedList absorbed={absorbed} />}
              {showExpanded ? (
                <HistoryTakenInList
                  takenIn={takenIn}
                  isInteractive={isInteractive}
                  onModeChange={onModeChange}
                  onSeparate={onSeparate}
                />
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

export const HistoryCommitRow = memo(HistoryCommitRowView, (previous, next) =>
  isSameData({ first: previous, second: next }),
);
