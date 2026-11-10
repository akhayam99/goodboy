import { useEffect, useState } from 'react';
import type { TerminalTabId } from '../../../../../shared/types/terminal';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import {
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../../../../store/slices/terminal/terminalOwner';
import { AppFrame } from '../audit/AppFrame';
import { mockSceneIpc } from '../mockSceneIpc';
import { devServerLines, terminalSnapshotAnswer } from '../terminalSceneOutput';
import { seedFrame, type FrameContext } from '../audit/frameSeed';
import { seedBrowserTab } from './seedBrowserTab';

export type RightDock = 'terminal' | 'browser' | null;

type Props = {
  readonly context: FrameContext;
  readonly view: string;
  readonly held: RightDock;
  readonly isRailCollapsed?: boolean;
};

const DEV_SERVER = brandedId<TerminalTabId>({ value: 'ux39-harborline-dev' });

type SeedParams = {
  readonly context: FrameContext;
  readonly view: string;
  readonly held: RightDock;
};

const seedDock = ({ context, view, held }: SeedParams): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  const sessionId = context === 'session' ? state.currentSessionId : null;
  if (sessionId !== null) {
    useAppStore.setState((current) => ({
      selectedAgentId: { ...current.selectedAgentId, [sessionId]: null },
    }));
  }
  if (held === 'browser' || view === 'browser') {
    seedBrowserTab({ sessionId });
  }
  if (held === 'terminal' && workspaceId !== null) {
    mockSceneIpc((command) =>
      command === 'terminal_snapshot' ? terminalSnapshotAnswer({ lines: devServerLines }) : null,
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
    state.openDrawer({ kind: 'terminal', sessionId: null, payload: { terminalId: DEV_SERVER } });
  }
  if (held === 'browser') {
    state.openDrawer(
      sessionId === null
        ? { kind: 'browser', sessionId: null, payload: null }
        : { kind: 'browser', sessionId, payload: null },
    );
  }
};

export const P10RightDockScene = ({ context, view, held, isRailCollapsed = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedFrame({ context });
    seedDock({ context, view, held });
    setIsReady(true);
  }, [context, view, held]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view={view} isRailCollapsed={isRailCollapsed} hasPane />;
};
