import type { MountId } from '@goodboy/types';
import { useCallback } from 'react';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { togglePane } from '../../../../../features/session/panes/togglePane';
import type { ClusterPane } from '../../../../../features/session/panes/clusterPane';
import { openPaneOf } from '../../../../../features/session/panes/openPaneOf';
import { useAppStore } from '../../../../../store';
import { sessionTerminalOwner } from '../../../../../store/slices/terminal/terminalOwner';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { useSceneRailFold } from '../useSceneRailFold';
import { shellPromptLines, terminalSnapshotAnswer } from '../terminalSceneOutput';

export type PanesSceneState =
  ClusterPane | 'closed' | 'folded' | 'drilled' | 'explore-file' | 'script-output';

const PAYMENTS = '~/code/harborline/payments-api-backfill';
const RELAY = '~/code/harborline/notify-relay/.goodboy/worktrees/gb-2p6w0z';
const SHELL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });
const RELAY_SHELL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t2` });
const PAYMENTS_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-payments-backfill' });
const RELAY_MOUNT = brandedId<MountId>({ value: 'mock-run-mount-console' });

const SCRIPT_STARTED_AT = Date.parse('2026-10-15T09:00:00.000Z');

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

type PaneParams = {
  readonly pane: ClusterPane;
};

const openPane = ({ pane }: PaneParams): void => {
  if (openPaneOf({ state: useAppStore.getState(), sessionId: SESSION_ID }) === pane) {
    return;
  }
  togglePane({ sessionId: SESSION_ID, pane });
};

const seedFailedCheck = (): void => {
  useAppStore.setState((current) => {
    const entry = current.mountGithub[RELAY_MOUNT];
    if (entry === undefined || entry.pr === null) {
      return {};
    }
    return {
      mountGithub: {
        ...current.mountGithub,
        [RELAY_MOUNT]: { ...entry, pr: { ...entry.pr, checks: 'failure' } },
      },
    };
  });
};

const openState = ({ state }: SeedParams): void => {
  seedFailedCheck();
  const store = useAppStore.getState();
  if (state === 'closed') {
    return;
  }
  if (state === 'folded') {
    openPane({ pane: 'ask' });
    return;
  }
  if (state === 'drilled') {
    useAppStore.setState((current) => ({
      activeLens: { ...current.activeLens, [SESSION_ID]: 'branch' },
    }));
    openPane({ pane: 'explore' });
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
    useAppStore.setState((current) => ({
      scriptRuns: {
        ...current.scriptRuns,
        [SESSION_ID]: {
          ...current.scriptRuns[SESSION_ID],
          'package:test': {
            status: 'ok',
            result: { stdout: 'Test Files  12 passed (12)\n', stderr: '', exitCode: 0 },
            runId: 'mock-c03-run-test',
            startedAt: SCRIPT_STARTED_AT,
            completedAt: SCRIPT_STARTED_AT + 42_000,
            name: 'test',
          },
        },
      },
    }));
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
  openPane({ pane: state });
};

type Props = {
  readonly state: PanesSceneState;
};

export const PanesScene = ({ state }: Props) => {
  const seed = useCallback(() => openState({ state }), [state]);
  useSceneRailFold({ isFolded: state === 'folded' });

  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
