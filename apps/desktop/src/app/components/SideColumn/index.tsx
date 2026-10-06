import { cn } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { SessionNavSidebar } from '../../../features/session/components/SessionNavSidebar';
import type { ShellColumnScope } from '../../shellArrangement';
import { ChatDoorActivity } from './ChatDoorActivity';
import { ColumnDoorRow } from './ColumnDoorRow';
import { ColumnFoot } from './ColumnFoot';
import { ColumnToggleButton } from './ColumnToggleButton';
import { NewSessionRow } from './NewSessionRow';
import { COLUMN_DOORS, openColumnDoor, type ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

type Props = {
  readonly scope: ShellColumnScope;
  readonly workspaceId: WorkspaceId | null;
  readonly currentSessionId: SessionId | null;
  readonly place: ColumnPlace;
  readonly isCollapsed: boolean;
  readonly actions: ColumnActions;
  readonly onToggle: () => void;
  readonly onNavigate?: () => void;
  readonly settingsSlotRef?: (node: HTMLDivElement | null) => void;
  readonly isPeek?: boolean;
};

const LAYER =
  'absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 pb-2 pt-1 motion-safe:transition-[opacity,transform] motion-safe:duration-160 motion-safe:ease-out';

export const SideColumn = ({
  scope,
  workspaceId,
  currentSessionId,
  place,
  isCollapsed,
  actions,
  onToggle,
  onNavigate,
  settingsSlotRef,
  isPeek = false,
}: Props) => {
  const isSettingsShown = place === 'settings' && settingsSlotRef !== undefined;
  const go = (open: () => void) => () => {
    open();
    onNavigate?.();
  };

  return (
    <div data-side-column="" className="relative flex h-full min-h-0 min-w-0 flex-col">
      <nav
        aria-label="Sidebar"
        data-column-layer="nav"
        inert={isSettingsShown}
        className={cn(
          LAYER,
          isSettingsShown ? 'pointer-events-none -translate-x-1.5 opacity-0' : 'opacity-100',
        )}
      >
        <div className="flex w-11 shrink-0 items-center justify-center">
          <ColumnToggleButton isCollapsed={isCollapsed} onToggle={onToggle} />
        </div>
        {scope === 'workspace' && workspaceId !== null ? (
          <>
            <div className="flex shrink-0 flex-col gap-0.5 px-2">
              <NewSessionRow
                workspaceId={workspaceId}
                isCurrent={place === 'new'}
                {...(onNavigate !== undefined && { onNavigate })}
              />
              <div className="flex flex-col gap-0.5 pt-1">
                {COLUMN_DOORS.map((door) => (
                  <ColumnDoorRow
                    key={door.id}
                    id={door.id}
                    icon={door.icon}
                    label={door.label}
                    {...(door.shortcutId !== undefined && {
                      shortcut: shortcutGlyphs(door.shortcutId),
                    })}
                    isCurrent={place === door.id}
                    {...(door.id === 'chat' && { trailing: <ChatDoorActivity /> })}
                    onSelect={go(() => openColumnDoor({ id: door.id, actions }))}
                  />
                ))}
              </div>
            </div>
            <div data-column-sessions="" className="flex min-h-0 flex-1 flex-col">
              <SessionNavSidebar
                currentSessionId={place === null ? currentSessionId : null}
                {...(onNavigate !== undefined && { onNavigate })}
              />
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1" />
        )}
        <ColumnFoot
          place={place}
          isPrimary={!isPeek}
          actions={actions}
          {...(onNavigate !== undefined && { onNavigate })}
        />
      </nav>
      {settingsSlotRef === undefined ? null : (
        <div
          ref={settingsSlotRef}
          data-column-layer="settings"
          inert={!isSettingsShown}
          className={cn(
            LAYER,
            'px-2',
            isSettingsShown ? 'opacity-100' : 'pointer-events-none translate-x-1.5 opacity-0',
          )}
        />
      )}
    </div>
  );
};
