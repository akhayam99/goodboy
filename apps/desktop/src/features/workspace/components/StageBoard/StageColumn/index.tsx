import { PanelRightClose } from 'lucide-react';
import { cn, FilledEmptyState, Eyebrow, IconButton, ScrollFade, tintClasses } from '@goodboy/ui';
import type { Session, SessionId, SessionStage } from '@goodboy/types';
import { describeStageBucket } from '../../../../session/session-stage';
import {
  stateDescription,
  type StatePresentation,
} from '../../../../../shared/utils/statePresentation';
import { StageBoardCard } from '../StageBoardCard';
import type { BoardNavigation } from '../useBoardNavigation';
import { boardColumnIds } from '../boardColumnIds';
import { EMPTY_COPY, type ColumnKey } from './emptyCopy';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';

type ColumnSpec =
  { readonly kind: 'stage'; readonly stage: SessionStage } | { readonly kind: 'archived' };

type ColumnView = {
  readonly key: ColumnKey;
  readonly presentation: StatePresentation;
  readonly archived: boolean;
};

export type ColumnCollapse = {
  readonly label: string;
  readonly onCollapse: () => void;
};

const viewFor = (spec: ColumnSpec): ColumnView => {
  if (spec.kind === 'archived') {
    return {
      key: 'archived',
      presentation: {
        label: 'archived',
        reason: 'put away, still here if you need it back',
        tone: 'neutral',
        icon: CONCEPT_ICONS.archive,
      },
      archived: true,
    };
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
  readonly collapse?: ColumnCollapse;
};

export const StageColumn = ({
  spec,
  sessions,
  nav,
  selection,
  onClearSelection,
  onRestore,
  collapse,
}: StageColumnProps) => {
  const view = viewFor(spec);
  const empty = sessions.length === 0;
  const { isSelected } = selection;
  const ids = boardColumnIds({ key: view.key });
  const isFolding = collapse !== undefined;

  const header = (
    <span
      className="flex items-center gap-2"
      title={stateDescription({ presentation: view.presentation })}
    >
      <Eyebrow
        label={view.presentation.label}
        muted={empty}
        className={cn(!empty && tintClasses(view.presentation.tone).text)}
      />
      {!empty && (
        <span className="text-secondary tabular-nums text-faint-foreground">{sessions.length}</span>
      )}
    </span>
  );

  return (
    <div
      id={ids.column}
      className={cn(
        'flex min-h-0 flex-col',
        PANE_RHYTHM.board.colWidth,
        PANE_RHYTHM.board.colStack,
        isFolding &&
          'motion-safe:transition-[width] motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.2,0,0,1)] motion-safe:starting:w-11',
      )}
    >
      <div className="flex h-6 shrink-0 items-center justify-between gap-2">
        {header}
        {collapse !== undefined && (
          <IconButton
            id={ids.collapse}
            icon={PanelRightClose}
            iconSize={ICON_SIZE.control}
            variant="ghost"
            label={collapse.label}
            tooltip="Collapse"
            aria-expanded
            aria-controls={ids.column}
            onClick={collapse.onCollapse}
            className="p-1"
          />
        )}
      </div>

      {empty && (
        <FilledEmptyState
          icon={view.presentation.icon}
          title={EMPTY_COPY[view.key].title}
          className={PANE_RHYTHM.board.emptyMinHeight}
        />
      )}

      {!empty && (
        <ScrollFade orientation="vertical" className="flex-1">
          <div
            className={cn(
              'flex flex-col group-data-[selecting=true]/select-list:pb-24',
              PANE_RHYTHM.board.cardGap,
              isFolding &&
                'motion-safe:transition-opacity motion-safe:delay-80 motion-safe:duration-120 motion-safe:starting:opacity-0',
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
