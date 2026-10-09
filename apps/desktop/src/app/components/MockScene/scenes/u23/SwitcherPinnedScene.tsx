import { useEffect, useState } from 'react';
import { SwitcherPanel } from '../../../../../features/workspace/components/SessionSwitcher/SwitcherPanel';
import { useAppStore } from '../../../../../store';
import { SIDEBAR_NAV_DEFAULTS, seedSidebarNav, type SidebarNavSeed } from './sidebarNavSeed';

const noop = () => undefined;

const PINS = 3;

export const SwitcherPinnedScene = () => {
  const [seed, setSeed] = useState<SidebarNavSeed | null>(null);
  useEffect(() => {
    setSeed(seedSidebarNav({ ...SIDEBAR_NAV_DEFAULTS, pinCount: PINS }));
  }, []);
  const sessions = useAppStore((state) => state.sessions);
  if (seed === null) {
    return null;
  }
  const pinned = sessions.filter((session) => seed.pinned.some((entry) => entry.id === session.id));
  const recent = sessions.filter((session) => !pinned.includes(session)).slice(0, 4);
  return (
    <div className="flex h-screen items-start justify-center bg-scrim px-4 pt-16">
      <SwitcherPanel
        sessions={[...pinned, ...recent]}
        pinnedCount={pinned.length}
        selectedIndex={pinned.length}
        onChoose={noop}
      />
    </div>
  );
};
