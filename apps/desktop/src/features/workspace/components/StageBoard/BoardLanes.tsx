import { useCallback, useRef } from 'react';
import { cn, PANE_RHYTHM, ScrollFade, tintClasses } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../store';
import { useDragLasso } from '../../../../shared/hooks/useDragLasso';
import type { BoardLanes as BoardLanesLayout } from './boardLanesOf';
import { BOARD_STAGES } from './boardStages';
import { StageColumn } from './StageColumn';
import type { BoardNavigation } from './useBoardNavigation';
import type { BoardSelection } from './useBoardSelection';

const LANE_STAGES = BOARD_STAGES.filter((stage) => stage !== 'done');

const columnsClassOf = ({ layout }: { readonly layout: BoardLanesLayout }): string => {
  if (layout.scrolls) {
    return PANE_RHYTHM.board.lanesScroll;
  }
  return layout.stacked ? PANE_RHYTHM.board.lanesFive : PANE_RHYTHM.board.lanesSix;
};

type Props = {
  readonly layout: BoardLanesLayout;
  readonly byStage: ReadonlyMap<string, ReadonlyArray<Session>>;
  readonly archived: ReadonlyArray<Session>;
  readonly isArchivedLoading: boolean;
  readonly nav: BoardNavigation;
  readonly selection: BoardSelection;
  readonly onRestore: (session: Session) => void;
};

export const BoardLanes = ({
  layout,
  byStage,
  archived,
  isArchivedLoading,
  nav,
  selection,
  onRestore,
}: Props) => {
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const { selectIds, selectedIds } = selection;
  const onLassoSelect = useCallback(
    (ids: ReadonlyArray<SessionId>, mode: 'replace' | 'add') => selectIds(ids, mode),
    [selectIds],
  );
  const lasso = useDragLasso<SessionId>({ containerRef: columnsRef, onSelect: onLassoSelect });
  const placement = layout.stacked ? 'half' : 'lane';

  const done = (
    <StageColumn
      spec={{ kind: 'stage', stage: 'done' }}
      sessions={byStage.get('done') ?? EMPTY_ARRAY}
      nav={nav}
      selection={selection}
      onClearSelection={selection.clearAll}
      onRestore={onRestore}
      placement={placement}
    />
  );
  const archive = (
    <StageColumn
      spec={{ kind: 'archived' }}
      sessions={archived}
      nav={nav}
      selection={selection}
      onClearSelection={selection.clearAll}
      onRestore={onRestore}
      placement={placement}
      isLoading={isArchivedLoading}
    />
  );

  return (
    <ScrollFade orientation="horizontal" fadeSize="w-8" className="min-h-0 flex-1">
      <div
        ref={columnsRef}
        onPointerDown={lasso.onPointerDown}
        data-selecting={selectedIds.length > 0}
        className={cn(
          'group/select-list relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)]',
          PANE_RHYTHM.board.laneGap,
          columnsClassOf({ layout }),
        )}
      >
        {LANE_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            spec={{ kind: 'stage', stage }}
            sessions={byStage.get(stage) ?? EMPTY_ARRAY}
            nav={nav}
            selection={selection}
            onClearSelection={selection.clearAll}
            onRestore={onRestore}
          />
        ))}
        {layout.stacked ? (
          <div className={cn('flex min-h-0 min-w-0 flex-col', PANE_RHYTHM.board.halves)}>
            {done}
            {archive}
          </div>
        ) : (
          <>
            {done}
            {archive}
          </>
        )}
        {lasso.rect && (
          <div
            aria-hidden
            style={{
              left: lasso.rect.left,
              top: lasso.rect.top,
              width: lasso.rect.width,
              height: lasso.rect.height,
            }}
            className={cn(
              'pointer-events-none absolute z-10 rounded-sm border',
              tintClasses('primary').border,
              tintClasses('primary').bg,
            )}
          />
        )}
      </div>
    </ScrollFade>
  );
};
