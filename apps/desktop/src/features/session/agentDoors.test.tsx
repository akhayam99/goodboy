// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { AgentId, OpenQuestionId, SearchHit, SessionId } from '@goodboy/types';
import { TEST_NOW, anAgent, aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store/store';
import { AGENT_KIND } from '../actions/kinds/agent';
import { MESSAGE_KIND } from '../actions/kinds/message';
import type { ActionEnv } from '../actions/types';
import { useOpenAgentQuestion } from '../context/hooks/useOpenAgentQuestion';
import { openNotificationSession } from '../notifications/openNotificationSession';
import { openSearchHit } from '../search/openSearchHit';
import { useBoardNavigation } from '../workspace/components/StageBoard/useBoardNavigation';
import type { Notification } from '@goodboy/db';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

const SESSION = 'session-ledger-core' as SessionId;
const BUILDER = 'agent-builder' as AgentId;
const REVIEWER = 'agent-reviewer' as AgentId;
const QUESTION = 'question-1' as OpenQuestionId;

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const seed = () => {
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    sessions: [aSession({ id: SESSION })],
    currentSessionId: SESSION,
    sessionPhaseRuns: {
      [SESSION]: [
        anAgent({ id: BUILDER, sessionId: SESSION, name: 'Cap the retries', kind: 'implementer' }),
        anAgent({ id: REVIEWER, sessionId: SESSION, name: 'Review the cap', kind: 'reviewer' }),
      ],
    },
    sessionOpenQuestions: {},
    setCurrentSession: async () => undefined,
    selectAgent: async (sessionId: SessionId, agentId: AgentId) => {
      useAppStore.setState((state) => ({
        selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },
      }));
    },
  });
};

const landedAgent = (): AgentId | null => useAppStore.getState().selectedAgentId[SESSION] ?? null;

type Door = {
  readonly name: string;
  readonly open: (agentId: AgentId) => Promise<void> | void;
};

const agentAction = (id: string) => {
  const action = AGENT_KIND.actions.find((candidate) => candidate.id === id);
  if (action === undefined) {
    throw new Error(`missing agent action ${id}`);
  }
  return action;
};

const agentFacts = (agentId: AgentId) => {
  const facts = AGENT_KIND.facts({
    state: useAppStore.getState(),
    target: { kind: 'agent', sessionId: SESSION, agentId },
  });
  if (facts === null) {
    throw new Error('agent facts missing');
  }
  return facts;
};

const messageHit = (agentId: AgentId, kind: 'message' | 'agent'): SearchHit => ({
  docId: `${kind}:1`,
  kind,
  refId: '1',
  workspaceId: null,
  sessionId: SESSION,
  sessionTitle: 'Guard the settlement batch',
  agentId,
  agentName: 'Cap the retries',
  mountId: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: TEST_NOW,
  title: [{ text: 'Cap the retries', isMatch: false }],
  snippet: [],
});

const notificationFor = (agentId: AgentId): Notification => ({
  id: 'n1',
  title: 'Step summary degraded',
  coalesceKey: 'single',
  read: false,
  sessionId: SESSION,
  ts: TEST_NOW,
  kind: 'error',
  body: null,
  severity: 'warning',
  workspaceId: null,
  action: { kind: 'retry-step-summary', sessionId: SESSION, agentId },
});

const DOORS: ReadonlyArray<Door> = [
  {
    name: 'the palette and the object menu (Open agent)',
    open: async (agentId) => {
      await agentAction('agent.open').run({ facts: agentFacts(agentId), env, choice: null });
    },
  },
  {
    name: 'a notification that points at an agent',
    open: async (agentId) => {
      openNotificationSession({ notification: notificationFor(agentId) });
      await vi.waitFor(() => expect(useAppStore.getState().selectedAgentId[SESSION]).toBe(agentId));
    },
  },
  {
    name: 'a question the agent asked',
    open: (agentId) => {
      const { result } = renderHook(() => useOpenAgentQuestion({ sessionId: SESSION }));
      result.current({ question: { id: QUESTION, createdByAgentId: agentId } });
    },
  },
  {
    name: 'a search hit on an agent',
    open: async (agentId) => {
      await openSearchHit({ hit: messageHit(agentId, 'agent'), query: 'cap' });
    },
  },
  {
    name: 'the Board card, for the agent whose reply is unread',
    open: (agentId) => {
      useAppStore.setState((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [SESSION]: (state.sessionPhaseRuns[SESSION] ?? []).map((agent) =>
            agent.id === agentId ? { ...agent, lastFinishedAt: TEST_NOW } : agent,
          ),
        },
      }));
      const { result } = renderHook(() => useBoardNavigation());
      result.current.openUnreadReply(useAppStore.getState().sessions[0]!);
    },
  },
  {
    name: 'Message this agent',
    open: async (agentId) => {
      await agentAction('agent.message').run({ facts: agentFacts(agentId), env, choice: null });
    },
  },
  {
    name: 'a search hit on a message',
    open: async (agentId) => {
      await openSearchHit({ hit: messageHit(agentId, 'message'), query: 'cap' });
    },
  },
  {
    name: 'Open the agent from a message',
    open: (agentId) => {
      const action = MESSAGE_KIND.actions.find((candidate) => candidate.id === 'message.openAgent');
      action?.run({
        facts: { text: 'Cap the retries', sessionId: SESSION, agentId, hasComposer: true },
        env,
        choice: null,
      });
    },
  },
];

beforeEach(() => {
  seed();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

type ThroughParams = {
  readonly door: Door;
  readonly agentId: AgentId;
};

const through = async ({ door, agentId }: ThroughParams): Promise<AgentId | null> => {
  await door.open(agentId);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120);
  });
  return landedAgent();
};

describe('every door into the agent page', () => {
  for (const door of DOORS) {
    it(`lands on the one conversation from ${door.name}`, async () => {
      expect(await through({ door, agentId: BUILDER })).toBe(BUILDER);
    });
  }

  it('lands on the conversation from a plain agent place, the form Runs, Activity, the run page, the Now chip, hover cards and crumbs use', () => {
    useAppStore.getState().navigate({ to: { at: 'agent', sessionId: SESSION, agentId: BUILDER } });

    expect(landedAgent()).toBe(BUILDER);
  });

  it('opens the agent a door names, never the one picked before', async () => {
    const door = DOORS[0]!;
    expect(await through({ door, agentId: REVIEWER })).toBe(REVIEWER);
    expect(await through({ door, agentId: BUILDER })).toBe(BUILDER);
  });
});
