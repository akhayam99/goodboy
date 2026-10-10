import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ColumnRail } from '../../../SideColumn/ColumnRail';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { SIDEBAR_NAV_DEFAULTS, seedSidebarNav, type SidebarNavSeed } from '../u23/sidebarNavSeed';

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

const PIN_COUNT = 5;

export const RailOrderScene = () => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  useEffect(() => {
    const next = seedSidebarNav({ ...SIDEBAR_NAV_DEFAULTS, pinCount: PIN_COUNT });
    const first = next.pinned[1];
    useAppStore.setState({
      currentSessionId: first === undefined ? next.session.id : (first.id as SessionId),
      navigate: ({ to }) => {
        if (to.at === 'session') {
          useAppStore.setState({ currentSessionId: to.sessionId });
        }
      },
    });
    setSeed(next);
  }, []);
  if (seed === null) {
    return null;
  }
  return (
    <div className="flex h-screen min-h-0 bg-background">
      <div className="h-full border-r border-border-soft">
        <ColumnRail
          scope="workspace"
          workspaceId={seed.workspaceId}
          currentSessionId={currentSessionId}
          place={null}
          onToggle={noop}
          actions={ACTIONS}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col gap-2 p-6">
        <h1 className="text-title text-foreground">Pinned sessions keep their order</h1>
        <p className="text-body text-muted-foreground">
          Open another pinned session: only the frame moves.
        </p>
      </main>
    </div>
  );
};
