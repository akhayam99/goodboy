import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type Session,
  type SessionExternalTask,
  type SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SidebarFrameColumn } from './SidebarFrameColumn';
import { WORKSPACE_ID } from '../BoardScene';
import { ThemedScene } from '../u37/ThemedScene';

type Props = {
  readonly theme: 'dark' | 'light';
};

type KeyedRow = {
  readonly sessionId: string;
  readonly identifier: string;
};

type IdParams = {
  readonly id: string;
};

type SessionParams = {
  readonly session: Session;
};

type TaskParams = SessionParams & {
  readonly row: KeyedRow;
};

const PINNED: ReadonlyArray<string> = [
  'mock-board-session-rate-limit',
  'mock-board-session-settlement-rounding',
  'mock-board-session-onboarding-copy',
];

const UNREAD: ReadonlyArray<string> = [
  'mock-board-session-rate-limit',
  'mock-board-session-signing-secret',
];

const KEYED: ReadonlyArray<KeyedRow> = [
  { sessionId: 'mock-board-session-settlement-rounding', identifier: 'NW-142' },
  { sessionId: 'mock-board-session-signing-secret', identifier: 'ACME-87' },
];

const FINISHED_AT = brandId<IsoDateTime>({ value: '2026-11-02T09:00:00.000Z' });

const keyOf = ({ id }: IdParams): KeyedRow | undefined => KEYED.find((row) => row.sessionId === id);

const keyedGoal = ({ session }: SessionParams): Session => {
  const keyed = keyOf({ id: session.id });
  return keyed === undefined
    ? session
    : { ...session, goal: `[${keyed.identifier}] ${session.goal}` };
};

const taskOf = ({ row, session }: TaskParams) =>
  ({
    sessionId: session.id,
    provider: 'linear',
    externalId: `mock-sidebar-${row.identifier}`,
    identifier: row.identifier,
    url: `https://example.invalid/linear/${row.identifier}`,
    title: session.goal,
    createdAt: FINISHED_AT,
  }) satisfies SessionExternalTask;

const replyOf = ({ session }: SessionParams): Agent => ({
  id: brandId<AgentId>({ value: `mock-sidebar-reply-${session.id}` }),
  sessionId: session.id,
  ordinal: 0,
  name: 'Answer the review thread',
  kind: 'implementer',
  status: 'completed',
  startedAt: FINISHED_AT,
  completedAt: FINISHED_AT,
  lastFinishedAt: FINISHED_AT,
});

const seedSidebarRows = (): void => {
  const state = useAppStore.getState();
  const sessions = state.sessions.map((session) => keyedGoal({ session }));
  const tasks = Object.fromEntries(
    sessions.flatMap((session) => {
      const row = keyOf({ id: session.id });
      return row === undefined ? [] : [[session.id, [taskOf({ row, session })]]];
    }),
  );
  const replies = Object.fromEntries(
    sessions
      .filter((session) => UNREAD.includes(session.id))
      .map((session) => [session.id, [replyOf({ session })]]),
  );
  useAppStore.setState({
    sessions,
    sessionExternalTasks: { ...state.sessionExternalTasks, ...tasks },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, ...replies },
    sessionPins: {
      [WORKSPACE_ID]: PINNED.map((id, index) => ({
        id: brandId<SessionId>({ value: id }),
        at: index + 1,
      })),
    },
    sessionGroupExpanded: { ...state.sessionGroupExpanded, done: true },
  });
};

export const SidebarFrameScene = ({ theme }: Props) => (
  <ThemedScene theme={theme}>
    <SidebarFrameColumn afterSeed={seedSidebarRows} />
  </ThemedScene>
);
