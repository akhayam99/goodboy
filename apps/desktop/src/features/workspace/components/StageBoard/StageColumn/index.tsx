import { useState, type ReactNode } from 'react';
import {
  Button,
  cn,
  Eyebrow,
  ListItemMotion,
  ScrollFade,
  StatusDot,
  Tooltip,
  useListMotion,
} from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { ARCHIVED_LANE, describeStageBucket } from '../../../../session/session-stage';
import {
  stateDescription,
  type StatePresentation,
} from '../../../../../shared/utils/statePresentation';
import { sentenceCase } from '../../../../../shared/utils/sentenceCase';
import { StageBoardCard } from '../StageBoardCard';
import { ColumnSkeleton } from './ColumnSkeleton';
import { DoneLaneMenu } from './DoneLaneMenu';
import type { BoardNavigation } from '../useBoardNavigation';
import type { BoardLaneSpec } from '../boardLaneSpecs';
import { EMPTY_COPY, type ColumnKey } from './emptyCopy';
import { PANE_RHYTHM } from '@goodboy/ui';

const LANE_WINDOW = 50;

type ColumnView = {
  readonly key: ColumnKey;
  readonly presentation: StatePresentation;
  readonly archived: boolean;
};

const viewFor = (spec: BoardLaneSpec): ColumnView => {
  if (spec.kind === 'archived') {
    return { key: 'archived', presentation: ARCHIVED_LANE, archived: true };
  }
  return {
    key: spec.stage,
    presentation: describeStageBucket({ stage: spec.stage }),
    archived: false,
  };
};

type ColumnSelection = {
  readonly isSelected: (id: SessionId) => boolean;
  readonly getSelectedIds: () => ReadonlyArray<SessionId>;
  readonly onItemClick: (id: SessionId, event: ModifierEvent) => void;
  readonly onToggle: (id: SessionId, event: { readonly shiftKey: boolean }) => void;
};

type CardHover = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

type ModifierEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type StageColumnProps = {
  readonly spec: BoardLaneSpec;
  readonly sessions: ReadonlyArray<Session>;
  readonly action?: ReactNode;
  readonly lead?: ReactNode;
  readonly leadCount?: number;
  readonly nav: BoardNavigation;
  readonly selection: ColumnSelection;
  readonly onClearSelection: () => void;
  readonly onRestore: (session: Session) => Promise<void>;
  readonly placement?: 'lane' | 'half';
  readonly isLoading?: boolean;
  readonly motionResetKey?: string;
  readonly travelerIds?: ReadonlySet<string>;
  readonly onCardEnter?: (target: CardHover) => void;
  readonly onCardLeave?: () => void;
};

export const StageColumn = ({
  spec,
  sessions,
  action,
  lead = null,
  leadCount = 0,
  nav,
  selection,
  onClearSelection,
  onRestore,
  placement = 'lane',
  isLoading = false,
  motionResetKey = '',
  travelerIds,
  onCardEnter,
  onCardLeave,
}: StageColumnProps) => {
  const view = viewFor(spec);
  const count = sessions.length + leadCount;
  const isEmpty = count === 0;
  const isHalf = placement === 'half';
  const { isSelected } = selection;
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const isFinished = view.key === 'done' || view.key === 'archived';
  const isCollapsible = view.key === 'archived' && !isEmpty && !isLoading;
  const isCollapsed = isCollapsible && !isArchiveOpen;
  const hiddenCount = isFinished && !isWindowOpen ? Math.max(0, sessions.length - LANE_WINDOW) : 0;
  const drawn = isCollapsed ? [] : hiddenCount === 0 ? sessions : sessions.slice(0, LANE_WINDOW);
  const motion = useListMotion({
    items: drawn.map((session) => ({ key: session.id, value: session })),
    resetKey: motionResetKey,
    silentKeys: travelerIds,
  });

  return (
    <div
      role="group"
      aria-label={view.presentation.label}
      aria-busy={isLoading}
      data-lane={view.key}
      className={cn(
        'flex max-h-full min-h-0 w-full min-w-0 flex-col self-start',
        PANE_RHYTHM.board.lane,
        isHalf && (isEmpty || isCollapsed ? 'flex-none' : 'flex-initial'),
      )}
    >
      <div className="flex h-6 shrink-0 items-center justify-between gap-2 pl-1">
        <Tooltip content={stateDescription({ presentation: view.presentation })}>
          <span className="flex shrink-0 items-center gap-2">
            <StatusDot
              tone={view.presentation.tone}
              size="sm"
              pulsing={view.key === 'running' && !isEmpty}
            />
            <Eyebrow label={sentenceCase({ text: view.presentation.label })} muted={isEmpty} />
            {!isEmpty && (
              <span className="text-meta tabular-nums text-faint-foreground">{count}</span>
            )}
          </span>
        </Tooltip>
        {action === undefined ? null : <div className="flex min-w-0 justify-end">{action}</div>}
        {view.key === 'done' && !isEmpty && !isLoading && <DoneLaneMenu sessions={sessions} />}
        {isCollapsible && (
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={isArchiveOpen}
            onClick={() => setIsArchiveOpen((isOpen) => !isOpen)}
          >
            {isArchiveOpen ? 'Hide' : 'Show all'}
          </Button>
        )}
      </div>

      {isLoading && <ColumnSkeleton label="Loading sessions" />}

      {!isLoading && isEmpty && (
        <p
          data-slot="lane-empty"
          className="flex h-9 shrink-0 items-center rounded-md border border-dashed border-border-soft px-3 text-meta text-faint-foreground"
        >
          {EMPTY_COPY[view.key].title}
        </p>
      )}

      {!isEmpty && !isCollapsed && (
        <ScrollFade orientation="vertical" className="min-h-0 flex-initial">
          <div
            className={cn(
              'flex flex-col group-data-[selecting=true]/select-list:pb-24',
              isFinished ? 'gap-1' : PANE_RHYTHM.board.cardGap,
            )}
          >
            {lead}
            {motion.map((entry) => (
              <ListItemMotion key={entry.key} phase={entry.phase}>
                <StageBoardCard
                  session={entry.value}
                  nav={nav}
                  archived={view.archived}
                  density={isFinished ? 'row' : 'card'}
                  selected={isSelected(entry.value.id as SessionId)}
                  onModifierClick={selection.onItemClick}
                  getSelectedIds={selection.getSelectedIds}
                  onClearSelection={onClearSelection}
                  onRestore={onRestore}
                  onHoverEnter={onCardEnter}
                  onHoverLeave={onCardLeave}
                />
              </ListItemMotion>
            ))}
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setIsWindowOpen(true)}
              >
                {`Show ${hiddenCount} more`}
              </Button>
            )}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
