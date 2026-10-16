import type { MountId } from '@goodboy/types';
import { useCallback, useEffect } from 'react';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { togglePane } from '../../../../../features/session/panes/togglePane';
import type { ClusterPane } from '../../../../../features/session/panes/clusterPane';
import { useAppStore } from '../../../../../store';
import { sessionTerminalOwner } from '../../../../../store/slices/terminal/terminalOwner';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { shellPromptLines, terminalSnapshotAnswer } from '../terminalSceneOutput';

export type PanesSceneState = ClusterPane | 'closed' | 'more' | 'explore-file' | 'script-output';

const PAYMENTS = '~/code/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x';
const RELAY = '~/code/harborline/notify-relay/.goodboy/worktrees/gb-2p6w0z';
const SHELL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });
const RELAY_SHELL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t2` });
const OPEN_MENU_DELAY_MS = 50;
const PAYMENTS_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-payments' });
const RELAY_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-console' });

type TabParams = Pick<TerminalTab, 'id' | 'title' | 'cwd' | 'mountId'>;

const tabOf = ({ id, title, cwd, mountId }: TabParams): TerminalTab => ({
  id,
  owner: sessionTerminalOwner({ sessionId: SESSION_ID }),
  title,
  cwd,
  ...(mountId === undefined ? {} : { mountId }),
  status: 'running',
  createdAt: 0,
});

const sceneAnswer = (command: string): unknown => {
  if (command === 'terminal_snapshot') {
    return terminalSnapshotAnswer({ lines: shellPromptLines({ folder: 'payments-api' }) });
  }
  if (command === 'monitor_watched_ports') {
    return [];
  }
  return null;
};

const seedShells = (): void => {
  mockSceneIpc(sceneAnswer);
  useAppStore.setState({
    loadSessionMounts: async () => [],
    terminalTabs: {
      [SESSION_ID]: [
        tabOf({ id: SHELL, title: 'shell', cwd: PAYMENTS, mountId: PAYMENTS_MOUNT }),
        tabOf({ id: RELAY_SHELL, title: 'shell', cwd: RELAY, mountId: RELAY_MOUNT }),
      ],
    },
  });
  useAppStore.getState().rememberTerminalScope({ sessionId: SESSION_ID, cwd: PAYMENTS });
};

type SeedParams = {
  readonly state: PanesSceneState;
};

const openState = ({ state }: SeedParams): void => {
  const store = useAppStore.getState();
  if (state === 'closed' || state === 'more') {
    return;
  }
  if (state === 'explore-file') {
    store.openDrawer({
      kind: 'explore-file',
      sessionId: SESSION_ID,
      payload: {
        sessionDir: PAYMENTS,
        entry: {
          name: 'README.md',
          relPath: 'README.md',
          isDir: false,
          sizeBytes: 2_048,
          modifiedAt: null,
        },
        from: 'explore',
      },
    });
    return;
  }
  if (state === 'script-output') {
    store.openDrawer({
      kind: 'scriptRun',
      sessionId: SESSION_ID,
      payload: { scriptKey: 'package:test', mountId: null, from: 'scripts' },
    });
    return;
  }
  if (state === 'terminal') {
    seedShells();
    store.openDrawer({ kind: 'terminal', sessionId: SESSION_ID, payload: { terminalId: SHELL } });
    return;
  }
  togglePane({ sessionId: SESSION_ID, pane: state });
};

type Props = {
  readonly state: PanesSceneState;
};

export const PanesScene = ({ state }: Props) => {
  const seed = useCallback(() => openState({ state }), [state]);

  useEffect(() => {
    if (state !== 'more') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[aria-label^="More panes"]')?.click();
    }, OPEN_MENU_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
