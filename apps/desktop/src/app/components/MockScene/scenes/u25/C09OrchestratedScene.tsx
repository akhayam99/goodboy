import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useAppStore, useSessionById } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { DrawerHost } from '../../../DrawerHost';
import { SideColumn } from '../../../SideColumn';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import {
  C09_SESSION_ID,
  C09_WORKSPACE_ID,
  seedC09,
  type C09Page,
  type C09State,
} from './c09OrchestratedSeed';

type C09Click = 'none' | 'menu';

type Props = {
  readonly state: C09State;
  readonly page: C09Page;
  readonly click?: C09Click;
};

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

const CLICK_DELAY_MS = 200;

const SELECTOR: Readonly<Record<Exclude<C09Click, 'none'>, string>> = {
  menu: 'button[aria-label$="run actions"]',
};

export const C09OrchestratedScene = ({ state, page, click = 'none' }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C09_SESSION_ID);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);

  useEffect(() => {
    seedC09({ state, page });
    setIsSeeded(true);
  }, [state, page]);

  useEffect(() => {
    if (!isSeeded || click === 'none') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>(SELECTOR[click])?.click();
    }, CLICK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isSeeded, click]);

  if (!isSeeded || session === null) {
    return null;
  }

  return (
    <div data-shot className="flex h-screen min-h-0 bg-background text-foreground">
      <div className="h-full w-60 shrink-0 border-r border-border-soft">
        <SideColumn
          scope="workspace"
          workspaceId={C09_WORKSPACE_ID}
          currentSessionId={session.id}
          place={null}
          isCollapsed={false}
          actions={ACTIONS}
          onToggle={noop}
        />
      </div>
      <main className="relative flex min-w-0 flex-1">
        <DrawerColumn
          main={
            <div className="relative flex h-full min-w-0 flex-1 flex-col">
              <SessionWorkspace session={session} isActive />
            </div>
          }
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          sizing={sizing}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />
      </main>
    </div>
  );
};
