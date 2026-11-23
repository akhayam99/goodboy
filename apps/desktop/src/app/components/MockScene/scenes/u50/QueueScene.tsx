import { useEffect, useState } from 'react';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type OpenQuestionId,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
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

const CHANGED_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  ['src/retry/state.ts', 'src/checkout/retry.ts'],
  ['src/retry/state.ts', 'src/payout/export.ts', 'src/payout/schedule.ts', 'src/payout/csv.ts'],
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

const overlapRows = (): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  const state = useAppStore.getState();
  return RUNNING.flatMap((sessionId, index) => {
    const [mount] = state.sessionProjectMounts[sessionId] ?? [];
    return mount === undefined
      ? []
      : [
          {
            mountId: mount.mountId,
            sessionId,
            projectId: mount.projectId,
            branch: mount.branch,
            createdAt: index + 1,
            port: null,
            hasFixedPort: false,
            paths: CHANGED_PATHS[index] ?? [],
          },
        ];
  });
};

type MountsParams = {
  readonly mounts: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

const queueMountIdOf = ({ sessionId }: SessionParams): MountId =>
  brandId<MountId>({ value: `mock-queue-mount-${sessionId}` });

const ownMountsOf = ({
  mounts,
}: MountsParams): Readonly<Record<string, ReadonlyArray<SessionProjectMount>>> =>
  Object.fromEntries(
    RUNNING.map((sessionId) => {
      const [mount] = mounts[sessionId] ?? [];
      return [
        sessionId,
        mount === undefined
          ? []
          : [
              {
                ...mount,
                sessionId,
                mountId: queueMountIdOf({ sessionId }),
              },
            ],
      ];
    }),
  );

const seedQueue = ({ isClear }: Pick<Props, 'isClear'>): void => {
  seedBoardScene();
  useAppStore.setState((state) => ({
    navigation: {},
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      ...ownMountsOf({ mounts: state.sessionProjectMounts }),
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      ...Object.fromEntries(
        RUNNING.map((sessionId) => [
          sessionId,
          (state.sessionPhaseRuns[sessionId] ?? []).map((agent) => ({
            ...agent,
            mountId: queueMountIdOf({ sessionId }),
          })),
        ]),
      ),
    },
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
  const answers = new Map<string, unknown>([
    ['live_work', liveRows()],
    ['overlap_read', overlapRows()],
  ]);
  mockSceneIpc((command) => answers.get(command) ?? null);
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
