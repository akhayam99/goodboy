// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { AgentId, OpenQuestionId, SearchHit, SessionId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store/store';
import { AGENT_KIND } from '../actions/kinds/agent';
import { MESSAGE_KIND } from '../actions/kinds/message';
import type { ActionEnv } from '../actions/types';
import { useOpenAgentQuestion } from '../context/hooks/useOpenAgentQuestion';
import { openNotificationSession } from '../notifications/openNotificationSession';
import { openSearchHit } from '../search/openSearchHit';
import { useBoardNavigation } from '../workspace/components/StageBoard/useBoardNavigation';
import { agentOpenTab, isOpenAgentReveal } from './components/AgentDetailPane/agentOpenTab';
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

type Landing = {
  readonly agentId: AgentId | null;
  readonly tab: 'brief' | 'transcript';
};

const landingOf = (revealed: ReadonlyArray<Event>): Landing => {
  const state = useAppStore.getState();
  const agentId = state.selectedAgentId[SESSION] ?? null;
  const resolved = agentOpenTab({
    requested: state.agentPane[SESSION] ?? null,
    remembered: agentId === null ? null : (state.agentTab[agentId] ?? null),
  });
  const isPlainReveal = revealed.some((event) => !isOpenAgentReveal(event));
  return { agentId, tab: isPlainReveal ? 'transcript' : resolved };
};

type Door = {
  readonly name: string;
  readonly open: (agentId: AgentId) => Promise<void> | void;
  readonly lands: 'brief' | 'transcript';
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
  occurredAt: '2026-09-25T00:00:00.000Z' as SearchHit['occurredAt'],
  title: [{ text: 'Cap the retries', isMatch: false }],
  snippet: [],
});

const notificationFor = (agentId: AgentId): Notification =>
  ({
    id: 'n1',
    title: 'Step summary degraded',
    coalesceKey: 'single',
    read: false,
    sessionId: SESSION,
    ts: '2026-08-31T12:00:00.000Z',
    kind: 'error',
    body: null,
    severity: 'warning',
    workspaceId: null,
    action: { kind: 'retry-step-summary', sessionId: SESSION, agentId },
  }) as unknown as Notification;

const DOORS: ReadonlyArray<Door> = [
  {
    name: 'the palette and the object menu (Open agent)',
    open: (agentId) =>
      agentAction('agent.open').run({ facts: agentFacts(agentId), env, choice: null }),
    lands: 'brief',
  },
  {
    name: 'a notification that points at an agent',
    open: async (agentId) => {
      openNotificationSession({ notification: notificationFor(agentId) });
      await vi.waitFor(() => expect(useAppStore.getState().selectedAgentId[SESSION]).toBe(agentId));
    },
    lands: 'brief',
  },
  {
    name: 'a question the agent asked',
    open: (agentId) => {
      const { result } = renderHook(() => useOpenAgentQuestion({ sessionId: SESSION }));
      result.current({ question: { id: QUESTION, createdByAgentId: agentId } });
    },
    lands: 'brief',
  },
  {
    name: 'a search hit on an agent',
    open: async (agentId) => {
      await openSearchHit({ hit: messageHit(agentId, 'agent'), query: 'cap' });
    },
    lands: 'brief',
  },
  {
    name: 'the Board card',
    open: () => {
      const { result } = renderHook(() => useBoardNavigation());
      result.current.openAgent(useAppStore.getState().sessions[0]!);
    },
    lands: 'brief',
  },
  {
    name: 'Message this agent',
    open: (agentId) =>
      agentAction('agent.message').run({ facts: agentFacts(agentId), env, choice: null }),
    lands: 'transcript',
  },
  {
    name: 'a search hit on a message',
    open: async (agentId) => {
      await openSearchHit({ hit: messageHit(agentId, 'message'), query: 'cap' });
    },
    lands: 'transcript',
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
    lands: 'transcript',
  },
];

const revealed: Array<Event> = [];
const record = (event: Event) => revealed.push(event);

beforeEach(() => {
  seed();
  revealed.length = 0;
  window.addEventListener('goodboy:reveal-chat', record);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  window.removeEventListener('goodboy:reveal-chat', record);
  vi.useRealTimers();
  cleanup();
});

const through = async (door: Door, agentId: AgentId): Promise<Landing> => {
  await door.open(agentId);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120);
  });
  return landingOf(revealed);
};

describe('every door into the agent page', () => {
  for (const door of DOORS) {
    it(`lands on the ${door.lands} from ${door.name}`, async () => {
      const landing = await through(door, BUILDER);

      expect(landing.agentId).toBe(BUILDER);
      expect(landing.tab).toBe(door.lands);
    });
  }

  it('lands on the brief from a plain agent place, the form Runs, Activity, the run page, the Now chip, hover cards and crumbs use', () => {
    useAppStore.getState().navigate({ to: { at: 'agent', sessionId: SESSION, agentId: BUILDER } });

    expect(landingOf([])).toEqual({ agentId: BUILDER, tab: 'brief' });
  });
});

describe('the tab picked by hand', () => {
  it('is remembered for that agent only, and every brief door honours it', async () => {
    useAppStore.getState().setAgentTab({ agentId: BUILDER, pane: 'transcript' });

    const door = DOORS[0]!;
    expect((await through(door, BUILDER)).tab).toBe('transcript');
    expect((await through(door, REVIEWER)).tab).toBe('brief');
  });

  it('never leaks into another agent when the first one is picked after the second', async () => {
    const door = DOORS[0]!;
    useAppStore.getState().setAgentTab({ agentId: REVIEWER, pane: 'transcript' });

    expect((await through(door, BUILDER)).tab).toBe('brief');
    expect((await through(door, REVIEWER)).tab).toBe('transcript');
  });

  it('gives way to a door that targets a place', async () => {
    useAppStore.getState().setAgentTab({ agentId: BUILDER, pane: 'brief' });

    expect((await through(DOORS[5]!, BUILDER)).tab).toBe('transcript');
  });
});
