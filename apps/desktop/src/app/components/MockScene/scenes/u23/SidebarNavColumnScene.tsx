import { useEffect, useState } from 'react';
import { useAppStore, useCurrentSession } from '../../../../../store';
import { SessionRail } from '../../../SessionRail';
import { SideColumn } from '../../../SideColumn';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import type { ColumnPlace } from '../../../SideColumn/columnPlace';
import {
  SIDEBAR_NAV_DEFAULTS,
  seedSidebarNav,
  type SidebarNavConfig,
  type SidebarNavSeed,
} from './sidebarNavSeed';

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
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

type Props = {
  readonly config: Partial<SidebarNavConfig>;
  readonly place?: ColumnPlace;
  readonly isFramed?: boolean;
  readonly onSeeded?: () => void;
  readonly isSessionLevel?: boolean;
};

export const SidebarNavColumnScene = ({
  config,
  place = null,
  isFramed = false,
  onSeeded,
  isSessionLevel = false,
}: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  const current = useCurrentSession();
  useEffect(() => {
    const next = seedSidebarNav({ ...SIDEBAR_NAV_DEFAULTS, ...config });
    if (place === 'new') {
      useAppStore.setState({
        openSessionDraftWorkspaceId: next.workspaceId,
        currentSessionId: null,
      });
    }
    onSeeded?.();
    setSeed(next);
  }, [config, place, onSeeded]);
  if (seed === null) {
    return null;
  }
  if (isFramed) {
    return (
      <div data-shot className="flex h-[600px] bg-background">
        <div className="h-full w-72 shrink-0">
          <SideColumn
            scope="workspace"
            workspaceId={seed.workspaceId}
            currentSessionId={seed.session.id}
            place={place}
            isCollapsed={false}
            actions={ACTIONS}
            onToggle={noop}
          />
        </div>
        {isSessionLevel ? <SessionRail session={current ?? seed.session} /> : null}
      </div>
    );
  }
  return (
    <div className="flex h-screen min-h-0 bg-background">
      <div className="h-full w-64 shrink-0 border-r border-border-soft">
        <SideColumn
          scope="workspace"
          workspaceId={seed.workspaceId}
          currentSessionId={seed.session.id}
          place={place}
          isCollapsed={false}
          actions={ACTIONS}
          onToggle={noop}
        />
      </div>
    </div>
  );
};
