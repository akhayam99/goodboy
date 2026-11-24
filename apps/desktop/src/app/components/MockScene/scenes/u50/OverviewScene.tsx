import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { mockSceneIpc } from '../mockSceneIpc';
import { CentralColumnScene } from '../u26/CentralColumnScene';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

type LiveRowsParams = {
  readonly agentIds: ReadonlyArray<string>;
};

const TOOLS = [
  { name: 'Bash', command: 'pnpm test retry', path: null },
  { name: 'Edit', command: null, path: 'src/retry/state.ts' },
  { name: 'Grep', command: null, path: null },
];

const liveRowsOf = ({
  agentIds,
}: LiveRowsParams): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  agentIds.map((agentId, index) => ({
    runId: `run-overview-${index}`,
    sessionId: COLUMN_SESSION_ID,
    agentId,
    mountId: null,
    startedAt: Date.now() - (index + 2) * 60_000,
    tool: TOOLS[index % TOOLS.length],
    hasToolCall: true,
    canSeeTools: true,
  }));

export const OverviewScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedCentralColumn({ kind: 'branches' });
    const agentIds = (useAppStore.getState().sessionPhaseRuns[COLUMN_SESSION_ID] ?? [])
      .filter((agent) => agent.status === 'running')
      .map((agent) => agent.id);
    const rows = liveRowsOf({ agentIds });
    mockSceneIpc((command) => (command === 'live_work' ? rows : null));
    setIsReady(true);
  }, [theme]);
  return isReady ? <CentralColumnScene theme={theme} kind="branches" /> : null;
};
