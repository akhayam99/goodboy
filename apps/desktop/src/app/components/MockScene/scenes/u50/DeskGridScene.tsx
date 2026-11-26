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
import { gridWithLayout } from '../../../../../store/slices/drawer/dockTabs/gridWithLayout';
import { EMPTY_DRAWER_GRID } from '../../../../../store/slices/drawer/state';

export type DeskTools = 'terminal' | 'all' | 'merged';

const DEV_SERVER = brandedId<TerminalTabId>({ value: 'ux50-harborline-dev' });

const PORT_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['monitor_snapshot', PORTS_SNAPSHOT],
  ['process_ledger_list', []],
  ['monitor_watched_ports', []],
]);

const SCENE_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ...PORT_ANSWERS,
  ['terminal_snapshot', terminalSnapshotAnswer({ lines: devServerLines })],
]);

type SeedParams = {
  readonly tools: DeskTools;
  readonly isBusy: boolean;
};

const seedDesk = ({ tools, isBusy }: SeedParams): void => {
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
          status: isBusy ? 'attention' : 'running',
          createdAt: 0,
        },
      ],
    },
    activeTerminalTab: { [key]: DEV_SERVER },
  });
  if (tools !== 'terminal') {
    seedBrowserTab({ sessionId, otherAnswers: SCENE_ANSWERS });
    state.openDrawer({ kind: 'browser', sessionId, payload: null });
    useAppStore.setState({
      monitorSnapshot: PORTS_SNAPSHOT,
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    state.openDrawer({ kind: 'monitoring', sessionId: null, payload: null });
    state.openDrawer({ kind: 'scripts', sessionId, payload: null });
    state.openDrawer({ kind: 'ask', sessionId, payload: null });
  }
  state.openDrawer({ kind: 'terminal', sessionId: null, payload: { terminalId: DEV_SERVER } });
  if (tools === 'merged') {
    const grid = useAppStore.getState().drawerGrid ?? EMPTY_DRAWER_GRID;
    useAppStore.setState({
      drawerGrid: gridWithLayout({
        grid,
        layout: {
          columns: grid.columns
            .map((column) =>
              column
                .map((panel) => panel.kind)
                .filter((kind) => kind !== 'scripts' && kind !== 'ask'),
            )
            .filter((column) => column.length > 0),
          groups: { terminal: ['terminal', 'scripts', 'ask'] },
        },
        active: 'scripts',
      }),
    });
  }
  if (tools !== 'terminal') {
    seedArtifactDetail({ sessionId, workspaceId });
  }
};

type Props = {
  readonly tools: DeskTools;
  readonly width?: number;
  readonly isBusy?: boolean;
};

export const DeskGridScene = ({ tools, width, isBusy = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedDesk({ tools, isBusy });
    setIsReady(true);
  }, [tools, isBusy]);
  if (!isReady) {
    return null;
  }
  const frame = <AppFrame view="session" hasPane />;
  return width === undefined ? (
    frame
  ) : (
    <div data-scene-width={width} className="h-full" style={{ width }}>
      {frame}
    </div>
  );
};
