// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

const { prompts } = vi.hoisted(() => ({ prompts: new Array<string>() }));

vi.mock('../../../features/session/ask/activeAskBackend', async () => {
  const { createMemoryAskBackend } =
    await import('../../../features/session/ask/createMemoryAskBackend');
  return {
    activeAskBackend: createMemoryAskBackend({
      respond: async ({ request, onText }) => {
        prompts.push(request.prompt);
        onText('**Planner waits on [[Q1]].** [[A9]] is not real.');
        return { status: 'done' };
      },
    }),
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, OpenQuestionId, SessionId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { askInitialState } from './state';

const SESSION = 'session-webhooks' as SessionId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  prompts.length = 0;
  useAppStore.setState({
    ...askInitialState,
    sessions: [aSession({ id: SESSION, goal: 'Fix webhook retries' })],
    currentSessionId: SESSION,
    sessionPhaseRuns: {
      [SESSION]: [anAgent({ id: 'agent-planner' as AgentId, sessionId: SESSION, name: 'Planner' })],
    },
    sessionOpenQuestions: {
      [SESSION]: [
        {
          id: 'q-1' as OpenQuestionId,
          sessionId: SESSION,
          createdByAgentId: 'agent-planner' as AgentId,
          text: 'Stop after 5 attempts, or keep backing off?',
          suggestedAnswers: [],
          isBlocking: true,
          userAnswer: null,
          status: 'open',
          createdAt: '2026-10-06T09:00:00.000Z' as IsoDateTime,
        },
      ],
    },
  });
});

afterEach(() => {
  prompts.length = 0;
});

const messagesOf = () => {
  const state = useAppStore.getState();
  const threadId = state.askThreadId[SESSION] ?? null;
  return threadId === null ? [] : (state.askMessages[threadId] ?? []);
};

describe('sendAskQuestion', () => {
  it('starts one thread for the session and saves chips that survive a reload', async () => {
    const isSent = await useAppStore.getState().sendAskQuestion({
      sessionId: SESSION,
      question: 'What needs me?',
      rightNow: ['$0.00 in this session'],
    });

    expect(isSent).toBe(true);
    const state = useAppStore.getState();
    expect(state.askThreads[SESSION]?.map((thread) => thread.title)).toEqual(['What needs me?']);
    const [question, reply] = messagesOf();
    expect(question?.content).toBe('What needs me?');
    expect(reply?.status).toBe('done');
    expect(reply?.content).toBe(
      '**Planner waits on [[question:q-1|Question 1]].** [[A9]] is not real.',
    );
    expect(state.askStreams).toEqual({});
    expect(prompts[0]).toContain('# Session: Fix webhook retries');
    expect(prompts[0]).toContain(
      '- [Q1] from Planner: Stop after 5 attempts, or keep backing off?',
    );
    expect(prompts[0]?.endsWith('New question:\nWhat needs me?')).toBe(true);
  });

  it('keeps follow-ups in the same thread with the earlier turns in the prompt', async () => {
    const { sendAskQuestion } = useAppStore.getState();
    await sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    await sendAskQuestion({ sessionId: SESSION, question: 'And after that?', rightNow: [] });

    expect(useAppStore.getState().askThreads[SESSION]).toHaveLength(1);
    expect(messagesOf().map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(prompts[1]).toContain('Earlier in this chat:\nUser: What needs me?');
    expect(prompts[1]?.endsWith('New question:\nAnd after that?')).toBe(true);
  });

  it('starts a fresh thread after New and keeps the old one for Earlier', async () => {
    const state = useAppStore.getState();
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    state.newAskThread({ sessionId: SESSION });
    expect(messagesOf()).toEqual([]);
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What changed?', rightNow: [] });

    expect(useAppStore.getState().askThreads[SESSION]?.map((thread) => thread.title)).toEqual([
      'What changed?',
      'What needs me?',
    ]);
  });

  it('defaults to the chat line at low effort and refuses an empty question', async () => {
    const state = useAppStore.getState();
    expect(await state.sendAskQuestion({ sessionId: SESSION, question: '  ', rightNow: [] })).toBe(
      false,
    );
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    const thread = useAppStore.getState().askThreads[SESSION]?.[0];
    expect(thread?.provider).toBe('anthropic');
    expect(thread?.effort).toBe('low');
    expect(thread?.model).toMatch(/sonnet/);
  });
});
