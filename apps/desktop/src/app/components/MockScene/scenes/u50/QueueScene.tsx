import { useEffect, useState } from 'react';
import { brandId, type IsoDateTime, type OpenQuestionId, type SessionId } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore, useSessions } from '../../../../../store';
import { StageBoard } from '../../../../../features/workspace/components/StageBoard';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { mockSceneIpc } from '../mockSceneIpc';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isClear: boolean;
};

const ASKING = brandId<SessionId>({ value: 'mock-board-session-notify-backoff' });
const ASKED_AGO_MS = 26 * 60_000 * 60;
const WAITING: ReadonlyArray<string> = [
  ASKING,
  brandId<SessionId>({ value: 'mock-board-session-settlement-rounding' }),
];
const RUNNING = [
  brandId<SessionId>({ value: 'mock-board-session-checkout-retry' }),
  brandId<SessionId>({ value: 'mock-board-session-payout-export' }),
];

const TOOLS = [
  { name: 'Bash', command: 'pnpm test retry', path: null },
  { name: 'Edit', command: null, path: 'src/retry/state.ts' },
  { name: 'Grep', command: null, path: null },
];

const liveRows = (): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  const state = useAppStore.getState();
  return RUNNING.flatMap((sessionId, sessionIndex) =>
    (state.sessionPhaseRuns[sessionId] ?? []).slice(0, 2).map((agent, index) => ({
      runId: `run-queue-${sessionIndex}-${index}`,
      sessionId,
      agentId: agent.id,
      mountId: state.sessionProjectMounts[sessionId]?.[0]?.mountId ?? null,
      startedAt: Date.now() - (sessionIndex * 2 + index + 3) * 60_000,
      tool: TOOLS[(sessionIndex + index) % TOOLS.length],
      hasToolCall: true,
      canSeeTools: true,
    })),
  );
};

const seedQueue = ({ isClear }: Pick<Props, 'isClear'>): void => {
  seedBoardScene();
  useAppStore.setState((state) => ({
    navigation: {},
    sessions: isClear
      ? state.sessions.filter((session) => !WAITING.includes(session.id))
      : state.sessions,
    sessionOpenQuestions: isClear
      ? {}
      : {
          ...state.sessionOpenQuestions,
          [ASKING]: [
            {
              id: brandId<OpenQuestionId>({ value: 'mock-queue-question-backoff' }),
              sessionId: ASKING,
              text: 'Keep the notify-relay backoff at five minutes for Acme?',
              suggestedAnswers: ['Keep five minutes', 'Drop to one minute'],
              isBlocking: true,
              userAnswer: null,
              status: 'open',
              createdAt: brandId<IsoDateTime>({
                value: new Date(Date.now() - ASKED_AGO_MS).toISOString(),
              }),
            },
          ],
        },
  }));
  const rows = liveRows();
  mockSceneIpc((command) => (command === 'live_work' ? rows : null));
};

export const QueueScene = ({ theme, isClear }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sessions = useSessions();
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedQueue({ isClear });
    setIsReady(true);
  }, [isClear, theme]);
  return isReady ? (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />
    </main>
  ) : null;
};
