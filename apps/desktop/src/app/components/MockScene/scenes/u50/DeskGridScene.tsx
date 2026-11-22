import { useEffect, useState } from 'react';
import type { TerminalTabId } from '../../../../../shared/types/terminal';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import {
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../../../../store/slices/terminal/terminalOwner';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { devServerLines, terminalSnapshotAnswer } from '../terminalSceneOutput';
import { seedBrowserTab } from '../u39/seedBrowserTab';
import { seedArtifactDetail } from '../u42/seedArtifactDetail';
import { PORTS_SNAPSHOT } from '../u25/portsSeed';

export type DeskTools = 'terminal' | 'all';

const DEV_SERVER = brandedId<TerminalTabId>({ value: 'ux50-harborline-dev' });

const PORT_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['monitor_snapshot', PORTS_SNAPSHOT],
  ['process_ledger_list', []],
  ['monitor_watched_ports', []],
]);

type SeedParams = {
  readonly tools: DeskTools;
};

const seedDesk = ({ tools }: SeedParams): void => {
  seedFrame({ context: 'session' });
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  const sessionId = state.currentSessionId;
  if (workspaceId === null || sessionId === null) {
    return;
  }
  useAppStore.setState((current) => ({
    selectedAgentId: { ...current.selectedAgentId, [sessionId]: null },
  }));
  state.setSessionFace({ sessionId, face: 'desk' });
  mockSceneIpc((command) =>
    command === 'terminal_snapshot'
      ? terminalSnapshotAnswer({ lines: devServerLines })
      : (PORT_ANSWERS.get(command) ?? null),
  );
  const owner = workspaceTerminalOwner({ workspaceId });
  const key = terminalOwnerKey({ owner });
  useAppStore.setState({
    terminalTabs: {
      [key]: [
        {
          id: DEV_SERVER,
          owner,
          title: 'pnpm dev',
          cwd: '~/code/harborline',
          status: 'running',
          createdAt: 0,
        },
      ],
    },
    activeTerminalTab: { [key]: DEV_SERVER },
  });
  if (tools === 'all') {
    seedBrowserTab({ sessionId });
    state.openDrawer({ kind: 'browser', sessionId, payload: null });
    useAppStore.setState({
      monitorSnapshot: PORTS_SNAPSHOT,
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    state.openDrawer({ kind: 'monitoring', sessionId: null, payload: null });
  }
  state.openDrawer({ kind: 'terminal', sessionId: null, payload: { terminalId: DEV_SERVER } });
  if (tools === 'all') {
    seedArtifactDetail({ sessionId, workspaceId });
  }
};

type Props = {
  readonly tools: DeskTools;
};

export const DeskGridScene = ({ tools }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedDesk({ tools });
    setIsReady(true);
  }, [tools]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" hasPane />;
};
