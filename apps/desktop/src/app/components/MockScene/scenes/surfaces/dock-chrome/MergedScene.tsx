import { useCallback } from 'react';
import { gridWithLayout } from '../../../../../../store/slices/drawer/dockTabs/gridWithLayout';
import { brandedId } from '../../../../../../features/history/testing/brandedId';
import type { TerminalTab, TerminalTabId } from '../../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../../store';
import { sessionTerminalOwner } from '../../../../../../store/slices/terminal/terminalOwner';
import { ActivityRunScene } from '../../ActivityRunScene';
import { SESSION_ID } from '../../activityRunSeed';
import { mockSceneIpc } from '../../mockSceneIpc';
import { shellPromptLines, terminalSnapshotAnswer } from '../../terminalSceneOutput';

type AnswerParams = {
  readonly command: string;
};

const PAYMENTS = '~/code/harborline/payments-api';
const SHELL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::chrome` });

const shellTab: TerminalTab = {
  id: SHELL,
  owner: sessionTerminalOwner({ sessionId: SESSION_ID }),
  title: 'shell',
  cwd: PAYMENTS,
  status: 'running',
  createdAt: 0,
};

const mergedAnswerOf = ({ command }: AnswerParams): unknown => {
  if (command === 'terminal_snapshot') {
    return terminalSnapshotAnswer({ lines: shellPromptLines({ folder: 'payments-api' }) });
  }
  if (command === 'monitor_watched_ports') {
    return [];
  }
  return null;
};

const seedMerged = (): void => {
  mockSceneIpc((command) => mergedAnswerOf({ command }));
  useAppStore.setState({
    loadSessionMounts: async () => [],
    terminalTabs: { [SESSION_ID]: [shellTab] },
  });
  const store = useAppStore.getState();
  store.rememberTerminalScope({ sessionId: SESSION_ID, cwd: PAYMENTS });
  store.openDrawer({ kind: 'terminal', sessionId: SESSION_ID, payload: { terminalId: SHELL } });
  store.openDrawer({ kind: 'scripts', sessionId: SESSION_ID, payload: null });
  store.openDrawer({ kind: 'monitoring', sessionId: null, payload: null });
  useAppStore.setState((state) => ({
    drawerGrid: gridWithLayout({
      grid: state.drawerGrid,
      layout: {
        columns: [['terminal']],
        groups: { terminal: ['terminal', 'scripts', 'monitoring'] },
      },
      active: 'terminal',
    }),
  }));
};

export const MergedScene = () => {
  const seed = useCallback(() => seedMerged(), []);
  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
