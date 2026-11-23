import { useCallback } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { mockSceneIpc } from '../mockSceneIpc';
import { BoardShellScene } from '../BoardShellScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

const TOOLS = [
  { name: 'Bash', command: 'pnpm test reconcile', path: null },
  { name: 'Bash', command: 'pnpm build export', path: null },
];

const liveRowsOf = (): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  const state = useAppStore.getState();
  const running = state.sessions.filter((session) => session.state.kind === 'running');
  return running.map((session, index) => {
    const agent = (state.sessionPhaseRuns[session.id] ?? []).find(
      (candidate) => candidate.status === 'running',
    );
    const mountId =
      index === 0 ? (state.sessionProjectMounts[session.id]?.[0]?.mountId ?? null) : null;
    return {
      runId: `run-fleet-${index}`,
      sessionId: session.id,
      agentId: agent?.id ?? null,
      mountId,
      startedAt: Date.now() - (index + 3) * 60_000,
      tool: TOOLS[index % TOOLS.length],
      hasToolCall: true,
      canSeeTools: true,
    };
  });
};

export const FleetRowsScene = ({ theme }: Props) => {
  const afterSeed = useCallback(() => {
    applyDocumentTheme({ theme });
    const rows = liveRowsOf();
    mockSceneIpc((command) => (command === 'live_work' ? rows : null));
  }, [theme]);
  return <BoardShellScene afterSeed={afterSeed} />;
};
