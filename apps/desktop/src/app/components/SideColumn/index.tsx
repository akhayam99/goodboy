import { Fragment } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { SessionNavSidebar } from '../../../features/session/components/SessionNavSidebar';
import { NewSessionRow } from '../../../features/workspace/components/SessionActivityBar/NewSessionRow';
import { SidebarSessionsFilter } from '../../../features/workspace/components/SessionActivityBar/SidebarSessionsFilter';
import type { ShellColumnScope } from '../../shellArrangement';
import { ColumnDoorRow } from './ColumnDoorRow';
import { ColumnFoot } from './ColumnFoot';
import { ColumnToolTiles } from './ColumnToolTiles';
import { COLUMN_ROW_DOORS, openColumnDoor, type ColumnActions } from './columnDoors';
import { useDoorSignals } from './useDoorSignals';
import { isStudioOverSession, type ColumnPlace } from './columnPlace';

type Props = {
  readonly scope: ShellColumnScope;
  readonly workspaceId: WorkspaceId | null;
  readonly currentSessionId: SessionId | null;
  readonly place: ColumnPlace;
  readonly actions: ColumnActions;
  readonly onNavigate?: () => void;
  readonly isPeek?: boolean;
};

export const SideColumn = ({
  scope,
  workspaceId,
  currentSessionId,
  place,
  actions,
  onNavigate,
  isPeek = false,
}: Props) => {
  const signals = useDoorSignals({});
  const go = (open: () => void) => () => {
    open();
    onNavigate?.();
  };
  return (
    <div data-side-column="" className="relative flex h-full min-h-0 min-w-0 flex-col">
      <nav
        aria-label="Sidebar"
        data-column-layer="nav"
        className="absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 pb-2 pt-1"
      >
        {scope === 'workspace' && workspaceId !== null ? (
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <div className={cn('flex shrink-0 flex-col px-2', PANE_RHYTHM.navRail.doorGap)}>
              <NewSessionRow
                workspaceId={workspaceId}
                {...(onNavigate !== undefined && { onNavigate })}
              />
              {COLUMN_ROW_DOORS.map((door) => (
                <Fragment key={door.id}>
                  <ColumnDoorRow
                    id={door.id}
                    icon={door.icon}
                    label={door.label}
                    isQuiet={door.isReference === true}
                    {...(door.shortcutId !== undefined && { shortcut: door.shortcutId })}
                    isCurrent={place === door.id}
                    signal={signals[door.id]}
                    {...(door.id === 'chat' && {
                      create: {
                        label: 'New chat',
                        shortcut: 'chat.new',
                        onCreate: go(actions.openNewChat),
                      },
                    })}
                    {...(door.id === 'board' && {
                      action: <SidebarSessionsFilter workspaceId={workspaceId} />,
                    })}
                    onSelect={go(() => openColumnDoor({ id: door.id, actions }))}
                  />
                </Fragment>
              ))}
              <ColumnToolTiles
                place={place}
                actions={actions}
                signals={signals}
                {...(onNavigate !== undefined && { onNavigate })}
              />
            </div>
            <div data-column-sessions="" className="flex min-h-0 flex-1 flex-col">
              <SessionNavSidebar
                currentSessionId={
                  place === null || isStudioOverSession({ place }) ? currentSessionId : null
                }
                isStudioOver={isStudioOverSession({ place })}
                {...(onNavigate !== undefined && { onNavigate })}
              />
            </div>
          </div>
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
    </div>
  );
};
