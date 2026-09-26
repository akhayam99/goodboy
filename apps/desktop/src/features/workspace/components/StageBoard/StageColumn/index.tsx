import { PanelRightClose } from 'lucide-react';
import { cn, Eyebrow, IconButton, LensEmptyState, ScrollFade, tintClasses } from '@goodboy/ui';
import type { Session, SessionId, SessionStage } from '@goodboy/types';
import { describeStageBucket } from '../../../../session/session-stage';
import {
  stateDescription,
  type StatePresentation,
} from '../../../../../shared/utils/statePresentation';
import type { MultiSelect } from '../../../../../shared/hooks/useMultiSelect';
import { StageBoardCard } from '../StageBoardCard';
import type { BoardNavigation } from '../useBoardNavigation';
import { boardColumnIds } from '../boardColumnIds';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';

export type ColumnSpec =
  { readonly kind: 'stage'; readonly stage: SessionStage } | { readonly kind: 'archived' };

type ColumnKey = SessionStage | 'archived';

type EmptyCopy = {
  readonly title: string;
  readonly description: string;
};

const EMPTY_COPY: Record<ColumnKey, EmptyCopy> = {
  building: {
    title: 'Nothing in progress',
    description: 'A session waits here between agent runs, until it opens a pull request.',
  },
  running: {
    title: 'No agent running',
    description: 'A session moves here while an agent works on it.',
  },
  attention: {
    title: 'Nothing needs you',
    description:
      'A session lands here when an agent asks you something, stops on an error, or a check fails.',
  },
  review: {
    title: 'Nothing in review',
    description: 'A session moves here once its pull request is open.',
  },
  done: {
    title: 'Nothing done yet',
    description: 'Merged and closed sessions end up here.',
  },
  archived: {
    title: 'Nothing archived',
    description: 'Archived sessions wait here in case you need them back.',
  },
};

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

type StageColumnProps = {
  readonly spec: ColumnSpec;
  readonly sessions: ReadonlyArray<Session>;
  readonly nav: BoardNavigation;
  readonly selection: MultiSelect<SessionId>;
  readonly onArchive: (session: Session) => void;
  readonly onDelete: (session: Session) => void;
  readonly onRestore: (session: Session) => void;
  readonly collapse?: ColumnCollapse;
};

export const StageColumn = ({
  spec,
  sessions,
  nav,
  selection,
  onArchive,
  onDelete,
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
        <LensEmptyState
          icon={view.presentation.icon}
          title={EMPTY_COPY[view.key].title}
          description={EMPTY_COPY[view.key].description}
        />
      )}

      {!empty && (
        <ScrollFade orientation="vertical" className="flex-1">
          <div
            className={cn(
              'flex flex-col',
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
                onModifierClick={selection.handleItemClick}
                onArchive={onArchive}
                onDelete={onDelete}
                onRestore={onRestore}
              />
            ))}
          </div>
        </ScrollFade>
      )}
    </div>
  );
};
