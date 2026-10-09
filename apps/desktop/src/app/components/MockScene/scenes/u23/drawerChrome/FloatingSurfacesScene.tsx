import { useEffect, useState } from 'react';
import { CircleUser, Copy, GitBranch, Pencil } from 'lucide-react';
import { FLOATING_SURFACE, Popover, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { SessionHoverCardBody } from '../../../../../../features/workspace/components/SessionHoverCard/SessionHoverCardBody';
import { SwitcherPanel } from '../../../../../../features/workspace/components/SessionSwitcher/SwitcherPanel';
import { SESSION, seedActivityRunScene } from '../../activityRunSeed';

const noop = () => undefined;

const MENU_ROWS = [
  { key: 'rename', label: 'Rename', icon: Pencil },
  { key: 'copy', label: 'Copy link', icon: Copy },
  { key: 'branch', label: 'Open the branch', icon: GitBranch },
] as const;

const SWITCHER_SESSIONS = [
  SESSION,
  { ...SESSION, id: 'mock-run-session-ledger' as SessionId, goal: 'Ledger export speedup' },
  { ...SESSION, id: 'mock-run-session-notify' as SessionId, goal: 'Notify relay backoff' },
];

export const FloatingSurfacesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="grid grid-cols-2 items-start gap-6 bg-background p-6 text-foreground"
      style={{ width: 1000 }}
    >
      <Popover role="menu" ariaLabel="Session actions" className="w-60 p-1">
        {MENU_ROWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            onClick={noop}
            className={cn(
              'flex h-7 items-center gap-2 rounded-sm px-2 text-left text-label',
              ROW_INTERACTIVE,
            )}
          >
            <Icon size={ICON_SIZE.row} aria-hidden />
            {label}
          </button>
        ))}
      </Popover>
      <Popover role="dialog" ariaLabel="Assignee" className="w-80 gap-2 p-3">
        <p className="text-label text-foreground">Assign to</p>
        <div className="flex items-center gap-2 text-label text-muted-foreground">
          <CircleUser size={ICON_SIZE.row} aria-hidden />
          Robin Vale
        </div>
        <p className="text-meta text-faint-foreground">Robin reviews payments-api changes.</p>
      </Popover>
      <div className={cn(FLOATING_SURFACE, 'w-80 p-3 text-label')}>
        <SessionHoverCardBody session={SESSION} isArchived={false} onOpenAttention={noop} />
      </div>
      <SwitcherPanel sessions={SWITCHER_SESSIONS} selectedIndex={1} onChoose={noop} />
    </main>
  );
};
