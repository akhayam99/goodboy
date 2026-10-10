import { useEffect, useState } from 'react';
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
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

type Props = {
  readonly config: Partial<SidebarNavConfig>;
  readonly place?: ColumnPlace;
};

export const SidebarNavColumnScene = ({ config, place = null }: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  useEffect(() => {
    setSeed(seedSidebarNav({ ...SIDEBAR_NAV_DEFAULTS, ...config }));
  }, [config]);
  if (seed === null) {
    return null;
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
