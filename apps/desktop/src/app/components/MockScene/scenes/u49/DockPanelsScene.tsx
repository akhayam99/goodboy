import { useCallback } from 'react';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import { sessionTerminalOwner } from '../../../../../store/slices/terminal/terminalOwner';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { shellPromptLines, terminalSnapshotAnswer } from '../terminalSceneOutput';

export type DockPanelsShape = 'pair' | 'stack' | 'three';

const PAYMENTS = '~/code/harborline/payments-api';
const SHELL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::dock` });

const shellTab: TerminalTab = {
  id: SHELL,
  owner: sessionTerminalOwner({ sessionId: SESSION_ID }),
  title: 'shell',
  cwd: PAYMENTS,
  status: 'running',
  createdAt: 0,
};

type AnswerParams = {
  readonly command: string;
};

const sceneAnswer = ({ command }: AnswerParams): unknown => {
  if (command === 'terminal_snapshot') {
    return terminalSnapshotAnswer({ lines: shellPromptLines({ folder: 'payments-api' }) });
  }
  if (command === 'monitor_watched_ports') {
    return [];
  }
  return null;
};

type SeedParams = {
  readonly shape: DockPanelsShape;
};

const seedDock = ({ shape }: SeedParams): void => {
  mockSceneIpc((command) => sceneAnswer({ command }));
  useAppStore.setState({
    loadSessionMounts: async () => [],
    terminalTabs: { [SESSION_ID]: [shellTab] },
  });
  const store = useAppStore.getState();
  store.rememberTerminalScope({ sessionId: SESSION_ID, cwd: PAYMENTS });
  store.openDrawer({ kind: 'terminal', sessionId: SESSION_ID, payload: { terminalId: SHELL } });
  store.openDrawer({ kind: 'monitoring', sessionId: null, payload: null });
  if (shape === 'three') {
    store.openDrawer({ kind: 'browser', sessionId: null, payload: null });
    return;
  }
  if (shape === 'stack') {
    const entry = useAppStore
      .getState()
      .drawerGrid.columns.flat()
      .find((panel) => panel.kind === 'terminal');
    if (entry !== undefined) {
      useAppStore.getState().turnDockPair({ entry });
    }
  }
};

type Props = {
  readonly shape: DockPanelsShape;
};

export const DockPanelsScene = ({ shape }: Props) => {
  const seed = useCallback(() => seedDock({ shape }), [shape]);
  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
