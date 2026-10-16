import type { KeyboardEvent } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore, useCurrentSession } from '../../../store';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { SessionNavSidebar } from '../../../features/session/components/SessionNavSidebar';
import { NewSessionRow } from '../../../features/workspace/components/SessionActivityBar/NewSessionRow';
import type { ShellColumnScope } from '../../shellArrangement';
import { ColumnDoorRow } from './ColumnDoorRow';
import { ColumnFoot } from './ColumnFoot';
import { ColumnToggleButton } from './ColumnToggleButton';
import { COLUMN_DOORS, openColumnDoor, type ColumnActions } from './columnDoors';
import { LevelBackRow } from './LevelBackRow';
import { LevelStack } from './LevelStack';
import { SessionLevel } from './SessionLevel';
import { WorktreeLevel } from './WorktreeLevel';
import { openLens } from '../../../features/session/openLens';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { useDoorSignals } from './useDoorSignals';
import { useSidebarLevel } from './useSidebarLevel';
import { isStudioOverSession, type ColumnPlace } from './columnPlace';

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

const isBackKey = (event: KeyboardEvent): boolean =>
  event.key === '[' && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;

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
  const signals = useDoorSignals({});
  const level = useSidebarLevel({ place, currentSessionId });
  const currentSession = useCurrentSession();
  const leaveSessionLevel = useAppStore((state) => state.leaveSessionLevel);
  const isSettingsShown = place === 'settings' && settingsSlotRef !== undefined;
  const go = (open: () => void) => () => {
    open();
    onNavigate?.();
  };
  const levelSession =
    currentSession === null || currentSession.id !== currentSessionId ? null : currentSession;
  const levelBranch = useAppStore((state) =>
    currentSessionId === null ? undefined : state.sessionBranches[currentSessionId],
  );
  const leaveWorktreeLevel = () => {
    if (levelSession === null) {
      return;
    }
    openLens({ sessionId: levelSession.id, lens: null });
  };
  const sessionLevel =
    levelSession === null ? null : (
      <>
        <div className="shrink-0 px-2">
          <LevelBackRow label="Sessions" onBack={leaveSessionLevel} />
        </div>
        <SessionLevel session={levelSession} isActive={level === 'session'} />
      </>
    );
  const worktreeLevel =
    levelSession === null || isBranchlessSession({ branch: levelBranch }) ? null : (
      <>
        <div className="shrink-0 px-2">
          <LevelBackRow
            label={sessionTitle({ session: levelSession })}
            spokenLabel={`session ${sessionTitle({ session: levelSession })}`}
            onBack={leaveWorktreeLevel}
          />
        </div>
        {level === 'worktree' ? <WorktreeLevel session={levelSession} /> : null}
      </>
    );

  return (
    <div data-side-column="" className="relative flex h-full min-h-0 min-w-0 flex-col">
      <nav
        aria-label="Sidebar"
        data-column-layer="nav"
        data-sidebar-level={level}
        inert={isSettingsShown}
        onKeyDown={(event) => {
          if (level === 'workspace' || !isBackKey(event)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (level === 'worktree') {
            leaveWorktreeLevel();
            return;
          }
          leaveSessionLevel();
        }}
        className={cn(
          LAYER,
          isSettingsShown ? 'pointer-events-none -translate-x-1.5 opacity-0' : 'opacity-100',
        )}
      >
        <div className="flex w-11 shrink-0 items-center justify-center">
          <ColumnToggleButton isCollapsed={isCollapsed} onToggle={onToggle} />
        </div>
        {scope === 'workspace' && workspaceId !== null ? (
          <LevelStack
            level={level}
            session={sessionLevel}
            worktree={worktreeLevel}
            workspace={
              <>
                <div className={cn('flex shrink-0 flex-col px-2', PANE_RHYTHM.navRail.doorGap)}>
                  <NewSessionRow
                    workspaceId={workspaceId}
                    {...(onNavigate !== undefined && { onNavigate })}
                  />
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
                      signal={signals[door.id]}
                      {...(door.id === 'chat' && {
                        create: {
                          label: 'New chat',
                          shortcut: 'chat.new',
                          onCreate: go(actions.openNewChat),
                        },
                      })}
                      {...(door.id === 'terminal' && {
                        create: { label: 'New terminal', onCreate: go(actions.openNewTerminal) },
                      })}
                      onSelect={go(() => openColumnDoor({ id: door.id, actions }))}
                    />
                  ))}
                </div>
                <div data-column-sessions="" className="flex min-h-0 flex-1 flex-col">
                  <SessionNavSidebar
                    currentSessionId={
                      place === null || isStudioOverSession({ place }) ? currentSessionId : null
                    }
                    isStudioOver={isStudioOverSession({ place }) || level !== 'workspace'}
                    {...(onNavigate !== undefined && { onNavigate })}
                  />
                </div>
              </>
            }
          />
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
