import { useEffect, useState } from 'react';
import type { AgentId } from '@goodboy/types';
import { SpawnedPanel } from '../../../SpawnedPanel';
import { AGENTS_TOOL_SESSION_ID, seedAgentsTool } from './agentsToolSeed';

type Props = {
  readonly isEmpty: boolean;
  readonly selectedAgentId?: AgentId | null;
};

const noop = () => undefined;

export const AgentsToolScene = ({ isEmpty, selectedAgentId = null }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedAgentsTool({ isEmpty, selectedAgentId });
    setIsReady(true);
  }, [isEmpty, selectedAgentId]);

  if (!isReady) {
    return null;
  }
  return (
    <main className="flex h-screen bg-background text-foreground">
      <div className="flex h-full w-[360px] flex-col border-l border-border-soft">
        <SpawnedPanel sessionId={AGENTS_TOOL_SESSION_ID} onClose={noop} />
      </div>
    </main>
  );
};
