import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
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
};

export const SidebarNavColumnScene = ({
  config,
  place = null,
  isFramed = false,
  onSeeded,
}: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
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
      <div data-shot className="h-[600px] w-72 bg-background">
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
