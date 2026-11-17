import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { requestRename } from '../../../../../shared/utils/renameRequest';
import { runObjectKey } from '../../../../../features/actions/runObjectKey';
import { startRunEventName } from '../../../../../features/session/startRun/startRunEventName';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore, useSessionById } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { ShellLeft } from '../../../ShellLeft';
import { shellArrangement } from '../../../../shellArrangement';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { isDirectedScene } from '../../../../../shared/utils/isDirectedScene';
import { showDemoNotice } from '../../demo/director/showDemoNotice';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
import {
  C08_SESSION_ID,
  C08_RUN_ID,
  C08_WORKSPACE_ID,
  seedC08,
  type C08Selection,
  type C08State,
} from './c08RunSeed';

type C08Click = 'none' | 'menu' | 'addStep' | 'startRun' | 'change' | 'rowRename';

type Props = {
  readonly state: C08State;
  readonly selection: C08Selection | 'list';
  readonly click?: C08Click;
  readonly extra?: () => void;
  readonly theme?: 'light' | 'dark';
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
  openNewChat: open,
  openConnections: open,
  openMonitoring: open,
  openImpact: open,
  openSettings: open,
  openChangelog: open,
  openGuide: open,
});

const ACTIONS = actionsOf({ open: noop });

const DEMO_ACTIONS = actionsOf({ open: elsewhere });

const CLICK_DELAY_MS = 200;

const SELECTOR: Readonly<Record<Exclude<C08Click, 'none' | 'startRun'>, string>> = {
  menu: 'button[aria-label$="run actions"]',
  addStep: '[data-run-overview] [data-run-add-step] button',
  change: '[data-start-settings-change]',
  rowRename: `[data-row-key$="/${C08_RUN_ID}"]`,
};

export const C08RunScene = ({ state, selection, click = 'none', extra, theme }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(C08_SESSION_ID);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);

  useEffect(() => {
    if (theme !== undefined) {
      applyDocumentTheme({ theme });
    }
    seedC08({ state, selection });
    extra?.();
    setIsSeeded(true);
  }, [state, selection, extra, theme]);

  useEffect(() => {
    if (!isSeeded || click === 'none') {
      return;
    }
    const timer = window.setTimeout(() => {
      if (click === 'startRun') {
        window.dispatchEvent(new CustomEvent(startRunEventName({ sessionId: C08_SESSION_ID })));
        return;
      }
      const target = document.querySelector<HTMLElement>(SELECTOR[click]);
      if (click === 'rowRename') {
        const rowKey = target?.getAttribute('data-row-key');
        if (rowKey != null) {
          requestRename({
            objectKey: runObjectKey({ runId: C08_RUN_ID }),
            anchorKey: `run:${rowKey}`,
          });
        }
        return;
      }
      target?.click();
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
        workspaceId={C08_WORKSPACE_ID}
        actions={isDirectedScene() ? DEMO_ACTIONS : ACTIONS}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
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
