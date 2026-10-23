import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useAppStore, useSessionById } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { SideColumn } from '../../../SideColumn';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { useSceneRailFold } from '../useSceneRailFold';
import { isDirectedScene } from '../../demo/director/isDirectedScene';
import { showDemoNotice } from '../../demo/director/showDemoNotice';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import {
  C08_SESSION_ID,
  C08_WORKSPACE_ID,
  seedC08,
  type C08Selection,
  type C08State,
} from './c08RunSeed';

type C08Click = 'none' | 'menu' | 'addStep';

type Props = {
  readonly state: C08State;
  readonly selection: C08Selection | 'list';
  readonly click?: C08Click;
  readonly isFolded?: boolean;
};

const noop = () => undefined;

const ELSEWHERE_NOTICE =
  'This sample opens one run. In the app the sidebar takes you to the rest of Goodboy.';

const elsewhere = () => showDemoNotice({ message: ELSEWHERE_NOTICE });

type ActionsParams = {
  readonly open: () => void;
};

const actionsOf = ({ open }: ActionsParams): ColumnActions => ({
  openBoard: open,
  openInbox: open,
  openChat: open,
  openWorkflows: open,
  openTerminalStudio: open,
  openNewChat: open,
  openNewTerminal: open,
  openMonitoring: open,
  openImpact: open,
  openSettings: open,
  openChangelog: open,
  openGuide: open,
  openShortcuts: open,
});

const ACTIONS = actionsOf({ open: noop });

const DEMO_ACTIONS = actionsOf({ open: elsewhere });

const CLICK_DELAY_MS = 200;

const SELECTOR: Readonly<Record<Exclude<C08Click, 'none'>, string>> = {
  menu: 'button[aria-label$="run actions"]',
  addStep: '[data-spawned-panel] [data-run-add-step] button',
};

export const C08RunScene = ({ state, selection, click = 'none', isFolded = false }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C08_SESSION_ID);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);
  useSceneRailFold({ isFolded });

  useEffect(() => {
    seedC08({ state, selection });
    if (selection !== 'list') {
      useAppStore
        .getState()
        .openDrawer({ kind: 'spawned', sessionId: C08_SESSION_ID, payload: null });
    }
    setIsSeeded(true);
  }, [state, selection]);

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
          workspaceId={C08_WORKSPACE_ID}
          currentSessionId={session.id}
          place={null}
          actions={isDirectedScene() ? DEMO_ACTIONS : ACTIONS}
        />
      </div>
      <main className="relative flex min-w-0 flex-1 flex-col">
        <DrawerColumn
          main={
            <SessionFrame session={session}>
              <SessionWorkspace session={session} isActive />
            </SessionFrame>
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
