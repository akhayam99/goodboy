import { useEffect, useState } from 'react';
import { ColumnRail } from '../../../SideColumn/ColumnRail';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
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
  openShortcuts: noop,
};

const HOVER_TARGET = '[data-rail-session]';

type Props = {
  readonly config: Partial<SidebarNavConfig>;
  readonly isHovered?: boolean;
};

export const SidebarNavRailScene = ({ config, isHovered = false }: Props) => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  useEffect(() => {
    setSeed(seedSidebarNav({ ...SIDEBAR_NAV_DEFAULTS, ...config }));
  }, [config]);
  useEffect(() => {
    if (seed === null || !isHovered) {
      return;
    }
    const interval = window.setInterval(() => {
      const target = window.document.querySelector<HTMLElement>(HOVER_TARGET);
      if (target === null) {
        return;
      }
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isHovered, seed]);
  if (seed === null) {
    return null;
  }
  return (
    <div className="flex h-screen min-h-0 bg-background">
      <div className="h-full border-r border-border-soft">
        <ColumnRail
          scope="workspace"
          workspaceId={seed.workspaceId}
          currentSessionId={seed.session.id}
          place={null}
          onToggle={noop}
          actions={ACTIONS}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col gap-2 p-6">
        <h1 className="text-title text-foreground">{seed.session.goal}</h1>
        <p className="text-body text-muted-foreground">The sidebar is collapsed to its rail.</p>
      </main>
    </div>
  );
};
