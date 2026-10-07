import { cn, EmptyLine, EmptyState, Eyebrow, ScrollFade, tintClasses } from '@goodboy/ui';
import type { Session, SessionId, SessionStage } from '@goodboy/types';
import { ARCHIVED_LANE, describeStageBucket } from '../../../../session/session-stage';
import {
  stateDescription,
  type StatePresentation,
} from '../../../../../shared/utils/statePresentation';
import { StageBoardCard } from '../StageBoardCard';
import type { BoardNavigation } from '../useBoardNavigation';
import { EMPTY_COPY, type ColumnKey } from './emptyCopy';
import { PANE_RHYTHM } from '@goodboy/ui';

type ColumnSpec =
  { readonly kind: 'stage'; readonly stage: SessionStage } | { readonly kind: 'archived' };

type ColumnView = {
  readonly key: ColumnKey;
  readonly presentation: StatePresentation;
  readonly archived: boolean;
};

const viewFor = (spec: ColumnSpec): ColumnView => {
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

type ModifierEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type StageColumnProps = {
  readonly spec: ColumnSpec;
  readonly sessions: ReadonlyArray<Session>;
  readonly nav: BoardNavigation;
  readonly selection: ColumnSelection;
  readonly onClearSelection: () => void;
  readonly onRestore: (session: Session) => void;
  readonly placement?: 'lane' | 'half';
  readonly isLoading?: boolean;
};

export const StageColumn = ({
  spec,
  sessions,
  nav,
  selection,
  onClearSelection,
  onRestore,
  placement = 'lane',
  isLoading = false,
}: StageColumnProps) => {
  const view = viewFor(spec);
  const isEmpty = sessions.length === 0;
  const isHalf = placement === 'half';
  const { isSelected } = selection;

  return (
    <div
      role="group"
      aria-label={view.presentation.label}
      aria-busy={isLoading}
      className={cn(
        'flex min-h-0 min-w-0 flex-col',
        PANE_RHYTHM.board.laneStack,
        isHalf && (isEmpty ? 'flex-none' : 'flex-1 basis-0'),
      )}
    >
      <div className="flex h-6 shrink-0 items-center">
        <span
          className="flex items-center gap-2"
          title={stateDescription({ presentation: view.presentation })}
        >
          <Eyebrow
            label={view.presentation.label}
            muted={isEmpty}
            className={cn(!isEmpty && tintClasses(view.presentation.tone).text)}
          />
          {!isEmpty && (
            <span className="text-meta tabular-nums text-faint-foreground">{sessions.length}</span>
          )}
        </span>
      </div>

      {isLoading && <EmptyLine>Loading</EmptyLine>}

      {!isLoading && isEmpty && (
        <EmptyState
          icon={view.presentation.icon}
          title={EMPTY_COPY[view.key].title}
          size="section"
        />
      )}

      {!isEmpty && (
        <ScrollFade orientation="vertical" className="flex-1">
          <div
            className={cn(
              'flex flex-col group-data-[selecting=true]/select-list:pb-24',
              PANE_RHYTHM.board.cardGap,
            )}
          >
            {sessions.map((session) => (
              <StageBoardCard
                key={session.id}
                session={session}
                nav={nav}
                archived={view.archived}
                selected={isSelected(session.id as SessionId)}
                onModifierClick={selection.onItemClick}
                onToggleSelect={selection.onToggle}
                getSelectedIds={selection.getSelectedIds}
                onClearSelection={onClearSelection}
                onRestore={onRestore}
              />
            ))}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
