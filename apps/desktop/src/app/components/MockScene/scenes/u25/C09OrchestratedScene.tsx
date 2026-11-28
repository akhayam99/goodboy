import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useAppStore, useSessionById } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { DrawerHost } from '../../../DrawerHost';
import { ShellLeft } from '../../../ShellLeft';
import { shellArrangement } from '../../../../shellArrangement';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
import { ORCHESTRATED_COPY } from '../../../../../features/workflows/orchestratedCopy';
import {
  C09_SESSION_ID,
  C09_WORKSPACE_ID,
  seedC09,
  type C09Page,
  type C09State,
} from './c09OrchestratedSeed';

type C09Click = 'none' | 'menu' | 'guidance' | 'kind' | 'model';

type Props = {
  readonly state: C09State;
  readonly page: C09Page;
  readonly click?: C09Click;
  readonly isGuidanceRepeated?: boolean;
  readonly isRouted?: boolean;
};

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openHome: noop,
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openConnections: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

const CLICK_DELAY_MS = 200;

const TARGET: Readonly<Record<Exclude<C09Click, 'none'>, () => HTMLButtonElement | undefined>> = {
  menu: () =>
    document.querySelector<HTMLButtonElement>('button[aria-label$="run actions"]') ?? undefined,
  kind: () =>
    document.querySelector<HTMLButtonElement>('button[data-setting-chip="Kind"]') ?? undefined,
  model: () =>
    document.querySelector<HTMLButtonElement>('button[data-setting-chip="Orchestrator"]') ??
    undefined,
  guidance: () =>
    [...document.querySelectorAll<HTMLButtonElement>('section[aria-label="Goal"] button')].find(
      (button) => button.textContent === ORCHESTRATED_COPY.showGuidance,
    ),
};

export const C09OrchestratedScene = ({
  state,
  page,
  click = 'none',
  isGuidanceRepeated = false,
  isRouted = false,
}: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C09_SESSION_ID);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);

  useEffect(() => {
    seedC09({ state, page, isGuidanceRepeated, isRouted });
    setIsSeeded(true);
  }, [state, page, isGuidanceRepeated, isRouted]);

  useEffect(() => {
    if (!isSeeded || click === 'none') {
      return;
    }
    const timer = window.setTimeout(() => {
      TARGET[click]()?.click();
    }, CLICK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isSeeded, click]);

  if (!isSeeded || session === null) {
    return null;
  }

  return (
    <div data-shot className="flex h-screen min-h-0 bg-background text-foreground">
      <ShellLeft
        arrangement={shellArrangement({ hasWorkspace: true })}
        workspaceId={C09_WORKSPACE_ID}
        actions={ACTIONS}
      />
      <main className="relative flex min-w-0 flex-1">
        <DrawerColumn
          main={
            <SessionFrame session={session}>
              <SessionWorkspace session={session} />
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
