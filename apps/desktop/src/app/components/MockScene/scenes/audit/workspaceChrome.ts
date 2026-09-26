import type { AgentId, Session, SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../../store';
import { LENS_KINDS } from '../../../../../store/slices/session-view/types';
import { SESSION } from '../workflowSeed';
import { sceneParam } from './sceneParams';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-08-25T18:00:00.000Z' });

type SiblingParams = {
  readonly id: string;
  readonly goal: string;
  readonly state: Session['state'];
};

const sibling = ({ id, goal, state }: SiblingParams): Session => ({
  ...SESSION,
  id: id as SessionId,
  goal,
  state,
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: clock.iso({ at: '2026-08-25T15:00:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-08-25T17:40:00.000Z' }),
});

export const WORKSPACE_SIBLINGS: ReadonlyArray<Session> = [
  sibling({
    id: 'mock-states-sibling-rate',
    goal: 'Fix duplicate retries at the payments-api rate limit boundary',
    state: { kind: 'idle', lastActivityAt: clock.iso({ at: '2026-08-25T17:48:00.000Z' }) },
  }),
  sibling({
    id: 'mock-states-sibling-tax',
    goal: 'Handle tax exemptions for marketplace orders across every billing-api region and currency',
    state: { kind: 'idle', lastActivityAt: clock.iso({ at: '2026-08-25T17:52:00.000Z' }) },
  }),
  sibling({
    id: 'mock-states-sibling-ledger',
    goal: 'Add monthly ledger exports for finance',
    state: { kind: 'ended', endedAt: clock.iso({ at: '2026-08-25T15:51:00.000Z' }) },
  }),
];

type LensParams = {
  readonly value: string | null;
};

const lensOf = ({ value }: LensParams): LensKind | null =>
  [...LENS_KINDS].find((lens) => lens === value) ?? null;

type ChromeParams = {
  readonly session: Session;
  readonly siblings: ReadonlyArray<Session>;
};

export const seedWorkspaceChrome = ({ session, siblings }: ChromeParams): void => {
  const agent = sceneParam({ key: 'agent' });
  useAppStore.setState({
    currentWorkspaceId: session.workspaceId,
    currentSessionId: session.id,
    sessions: [session, ...siblings],
    activeLens: { [session.id]: lensOf({ value: sceneParam({ key: 'lens' }) }) },
    selectedAgentId: agent === null ? {} : { [session.id]: agent as AgentId },
    archivedSessions: { [session.workspaceId]: [] },
    sessionViewPrefs: { [session.workspaceId]: { sort: 'updatedAt', group: 'stage' } },
    providers: [
      {
        id: 'anthropic',
        binary: 'claude',
        capabilities: {
          models: [],
          supportsTools: true,
          supportsStream: true,
          supportsCheapModel: true,
        },
        connection: 'connected',
        version: '1.0.0',
        identity: 'mock-team',
        label: 'Claude',
        error: null,
        docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
      },
    ],
    notifications: [],
    notificationsLoading: false,
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    loadArchivedSessions: async () => undefined,
    navigate: () => undefined,
    loadSessionEvents: async () => undefined,
    loadSessionArtifacts: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
    loadSessionOpenQuestions: async () => undefined,
    loadPhaseRunsForSession: async () => undefined,
    loadSessionPlans: async () => undefined,
    loadAgentTranscript: async () => undefined,
    markAgentViewed: async () => undefined,
    refreshProviders: async () => undefined,
  });
};
