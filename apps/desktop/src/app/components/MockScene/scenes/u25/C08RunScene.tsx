import { useEffect, useState } from 'react';
import { useSessionById } from '../../../../../store';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { SideColumn } from '../../../SideColumn';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { useSceneRailFold } from '../useSceneRailFold';
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

const SELECTOR: Readonly<Record<Exclude<C08Click, 'none'>, string>> = {
  menu: 'button[aria-label$="run actions"]',
  addStep: '[data-run-level] [data-run-add-step] button',
};

export const C08RunScene = ({ state, selection, click = 'none', isFolded = false }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C08_SESSION_ID);
  useSceneRailFold({ isFolded });

  useEffect(() => {
    seedC08({ state, selection });
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
          actions={ACTIONS}
        />
      </div>
      <main className="relative flex min-w-0 flex-1 flex-col">
        <SessionFrame session={session}>
          <SessionWorkspace session={session} isActive />
        </SessionFrame>
      </main>
    </div>
  );
};
