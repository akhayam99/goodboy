import { useEffect, useState } from 'react';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { SessionTools } from '../../../../../features/session/components/SessionTools';
import type { TerminalTabId } from '../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../store';

const SESSION_ID = brandId<SessionId>({ value: 'mock-rail-counts-session-settlement' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-rail-counts-workspace' });

const seedRailCounts = (): void => {
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    browserTabCounts: { [WORKSPACE_ID]: 12 },
    terminalTabs: {
      [SESSION_ID]: [
        {
          id: brandId<TerminalTabId>({ value: `${SESSION_ID}::t1` }),
          owner: { kind: 'session', sessionId: SESSION_ID },
          title: 'pnpm dev',
          cwd: null,
          status: 'running',
          createdAt: 1,
        },
      ],
    },
    drawer: { kind: 'browser', sessionId: SESSION_ID, payload: null },
  });
};

export const RailCountsToolsScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedRailCounts();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <div data-shot className="flex h-40 w-72">
        <h1 className="flex-1 p-6 text-ui text-muted-foreground">Fix the settlement replay</h1>
        <SessionTools sessionId={SESSION_ID} />
      </div>
    </main>
  );
};
