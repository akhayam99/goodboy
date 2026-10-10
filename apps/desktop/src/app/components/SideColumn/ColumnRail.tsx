import { Plus } from 'lucide-react';
import { COLLAPSED_RAIL_WIDTH, cn, tintClasses } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectSessionDraft } from '../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../store/slices/sessionDraft/hasSessionDraftContent';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { requestNewSession } from '../../../features/session/requestNewSession';
import type { ShellColumnScope } from '../../shellArrangement';
import { GoodboyChip } from '../GoodboyChip';
import { ColumnToggleButton } from './ColumnToggleButton';
import { ChatDoorActivity } from './ChatDoorActivity';
import { RailButton } from './RailButton';
import { RailSessions } from './RailSessions';
import { ReportBugButton } from './ReportBugButton';
import { COLUMN_DOORS, openColumnDoor, type ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

type Props = {
  readonly scope: ShellColumnScope;
  readonly workspaceId?: WorkspaceId | null;
  readonly currentSessionId?: SessionId | null;
  readonly place: ColumnPlace;
  readonly onToggle: () => void;
  readonly actions: ColumnActions;
};

const PRIMARY = tintClasses('primary');

const DRAFT_LABEL = 'New session, draft in progress';

export const ColumnRail = ({
  scope,
  workspaceId = null,
  currentSessionId = null,
  place,
  onToggle,
  actions,
}: Props) => {
  const hasDraft = useAppStore((state) =>
    workspaceId === null
      ? false
      : hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const isDraftWaiting = hasDraft && place !== 'new';
  return (
    <nav
      aria-label="Sidebar"
      data-column-rail=""
      className="flex h-full min-w-0 shrink-0 flex-col items-center gap-1 py-2"
      style={{ width: COLLAPSED_RAIL_WIDTH }}
    >
      <ColumnToggleButton isCollapsed onToggle={onToggle} />
      {scope === 'workspace' ? (
        <>
          <RailButton
            id="new"
            icon={Plus}
            label={isDraftWaiting ? DRAFT_LABEL : 'New session'}
            shortcut={shortcutGlyphs('session.new')}
            isCurrent={place === 'new'}
            className={place === 'new' ? undefined : cn(PRIMARY.bg, PRIMARY.icon, PRIMARY.hoverBg)}
            {...(isDraftWaiting && {
              badge: (
                <span
                  aria-hidden
                  data-slot="draft-dot"
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
                />
              ),
            })}
            onSelect={requestNewSession}
          />
          <div className="flex flex-col items-center gap-1 pt-2">
            {COLUMN_DOORS.map((door) => (
              <RailButton
                key={door.id}
                id={door.id}
                icon={door.icon}
                label={door.label}
                {...(door.shortcutId !== undefined && {
                  shortcut: shortcutGlyphs(door.shortcutId),
                })}
                isCurrent={place === door.id}
                {...(door.id === 'chat' && {
                  badge: (
                    <span className="absolute right-0.5 top-0.5 flex">
                      <ChatDoorActivity />
                    </span>
                  ),
                })}
                onSelect={() => openColumnDoor({ id: door.id, actions })}
              />
            ))}
          </div>
          {workspaceId === null ? null : (
            <RailSessions
              workspaceId={workspaceId}
              currentSessionId={currentSessionId}
              place={place}
            />
          )}
        </>
      ) : null}
      <div className="min-h-0 flex-1" />
      <RailButton
        id="settings"
        icon={CONCEPT_ICONS.settings}
        label="Settings"
        shortcut={shortcutGlyphs('settings.open')}
        isCurrent={place === 'settings'}
        onSelect={actions.openSettings}
      />
      <ReportBugButton variant="rail" />
      <GoodboyChip
        variant="rail"
        onOpenChangelog={actions.openChangelog}
        onOpenGuide={actions.openGuide}
        onOpenShortcuts={actions.openShortcuts}
      />
    </nav>
  );
};
