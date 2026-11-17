import { useEffect, useState } from 'react';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { SessionTools } from '../../../../../features/session/components/SessionTools';
import type { TerminalTabId } from '../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../store';

const SESSION_ID = brandId<SessionId>({ value: 'mock-rail-signal-session-credit' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-rail-signal-workspace' });
const TERMINAL_ID = brandId<TerminalTabId>({ value: `${SESSION_ID}::t1` });

const seedRailSignal = (): void => {
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    browserTabCounts: { [WORKSPACE_ID]: 3 },
    terminalTabs: {
      [SESSION_ID]: [
        {
          id: TERMINAL_ID,
          owner: { kind: 'session', sessionId: SESSION_ID },
          title: 'shell',
          cwd: null,
          status: 'running',
          createdAt: 1,
        },
      ],
    },
    terminalFinishes: {
      [SESSION_ID]: {
        terminalId: TERMINAL_ID,
        title: 'shell',
        command: 'pnpm test retry',
        durationMs: 42_000,
      },
    },
    drawer: null,
  });
};

export const RailSignalToolsScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedRailSignal();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <div data-shot className="flex h-40 w-72">
        <h1 className="flex-1 p-6 text-ui text-muted-foreground">Post one credit per retry</h1>
        <SessionTools sessionId={SESSION_ID} />
      </div>
    </main>
  );
};
