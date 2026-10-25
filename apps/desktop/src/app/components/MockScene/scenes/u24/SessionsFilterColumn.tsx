import { useEffect, useState } from 'react';
import type { SessionStage, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { DEFAULT_PREFS } from '../../../../../store/slices/session-view/types';
import { SideColumn } from '../../../SideColumn';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { SIDEBAR_NAV_DEFAULTS, seedSidebarNav, type SidebarNavSeed } from '../u23/sidebarNavSeed';

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openTerminalStudio: noop,
  openNewChat: noop,
  openNewTerminal: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

const PIN_COUNT = 1;
const OPEN_DELAY_MS = 50;

export type SessionsFilterConfig = {
  readonly statusFilter: ReadonlyArray<SessionStage>;
  readonly isPopoverOpen: boolean;
  readonly hasOpenSession: boolean;
};

type Props = {
  readonly config: SessionsFilterConfig;
};

const seedPrefs = ({
  workspaceId,
  statusFilter,
}: {
  readonly workspaceId: WorkspaceId;
  readonly statusFilter: ReadonlyArray<SessionStage>;
}): void => {
  useAppStore.setState((state) => ({
    sessionViewPrefs: {
      ...state.sessionViewPrefs,
      [workspaceId]: { ...DEFAULT_PREFS, statusFilter },
    },
  }));
};

export const SessionsFilterColumn = ({ config }: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  useEffect(() => {
    const next = seedSidebarNav({
      ...SIDEBAR_NAV_DEFAULTS,
      pinCount: config.hasOpenSession ? PIN_COUNT : 0,
    });
    seedPrefs({ workspaceId: next.workspaceId, statusFilter: config.statusFilter });
    if (!config.hasOpenSession) {
      useAppStore.setState({ currentSessionId: null });
    }
    setSeed(next);
  }, [config]);
  useEffect(() => {
    if (seed === null || !config.isPopoverOpen) {
      return;
    }
    const timer = setTimeout(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Filter sessions"]')?.click();
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [config.isPopoverOpen, seed]);
  if (seed === null) {
    return null;
  }
  return (
    <div className="flex h-screen min-h-0 bg-background">
      <div className="h-full w-64 shrink-0 border-r border-border-soft">
        <SideColumn
          scope="workspace"
          workspaceId={seed.workspaceId}
          currentSessionId={config.hasOpenSession ? seed.session.id : null}
          place={null}
          actions={ACTIONS}
        />
      </div>
    </div>
  );
};
