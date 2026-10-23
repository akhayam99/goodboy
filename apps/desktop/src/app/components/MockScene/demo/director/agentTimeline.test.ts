// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type ProviderRunId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createPlaybackClock } from './createPlaybackClock';
import { createSceneDirector } from './createSceneDirector';
import { createSimulatedSend } from './createSimulatedSend';
import { agentTimeline } from './agentTimeline';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const AT = brandId<IsoDateTime>({ value: '2026-10-16T15:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'demo-test-run' });
const session = aSession({ goal: 'Stop payments-api from double-crediting invoices' });
const agent = anAgent({ sessionId: session.id, status: 'completed', kind: 'implementer' });
const QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'demo-test-question' }),
  sessionId: session.id,
  createdByAgentId: agent.id,
  text: 'Banner or badge?',
  suggestedAnswers: ['Banner', 'Badge'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: AT,
};
const delegate = anAgent({
  sessionId: session.id,
  status: 'running',
  sourceKind: 'open_question',
  sourceThreadId: QUESTION.id,
});

const seed = (): void => {
  store.setState({
    sessions: [session],
    currentSessionId: session.id,
    selectedAgentId: { [session.id]: agent.id },
    sessionPhaseRuns: { [session.id]: [agent, delegate] },
    sessionOpenQuestions: { [session.id]: [QUESTION] },
    transcripts: {
      [agent.id]: [
        { kind: 'user_text', runId: RUN, text: 'Fix the double credit.', at: AT },
        { kind: 'assistant_text', runId: RUN, delta: 'Here is the plan.', at: AT },
        { kind: 'file_edit', runId: RUN, path: '/mock/handler.ts', editType: 'modify', at: AT },
        { kind: 'assistant_text', runId: RUN, delta: 'The guard is in. One call left.', at: AT },
        { kind: 'done', runId: RUN, at: AT },
      ],
    },
  });
};

const nowIso = (): IsoDateTime => brandId<IsoDateTime>({ value: new Date().toISOString() });

describe('the agent timeline', () => {
  it('rewinds the seeded turn and replays it up to the blocking question', () => {
    seed();
    const timeline = agentTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no agent timeline');
    }
    const director = createSceneDirector({
      timeline,
      store,
      clock: createPlaybackClock({ now: () => Date.now() }),
      isSettled: false,
      now: nowIso,
      onReport: () => undefined,
    });
    director.start();
    expect(store.getState().sessionOpenQuestions[session.id]).toEqual([]);
    expect(store.getState().agentTurnState[agent.id]?.kind).toBe('running');
    expect(store.getState().sessionPhaseRuns[session.id]?.map((entry) => entry.id)).toEqual([
      agent.id,
    ]);
    director.play();
    vi.advanceTimersByTime(30000);
    const state = store.getState();
    expect(state.sessionOpenQuestions[session.id]?.map((entry) => entry.id)).toEqual([QUESTION.id]);
    expect(state.transcripts[agent.id]?.at(-1)?.kind).toBe('done');
    expect(state.agentDraft[agent.id]?.length).toBeGreaterThan(0);
  });
});

describe('the simulated send', () => {
  it('appends the user turn, runs the agent and streams a reply to the end', async () => {
    seed();
    const send = createSimulatedSend({
      store,
      reply: 'On it. Done soon.',
      now: nowIso,
      shouldClearDraft: true,
    });
    await send({ sessionId: session.id, agentId: agent.id, content: 'Log the event id.' });
    const started = store.getState();
    expect(started.transcripts[agent.id]?.at(-1)).toMatchObject({
      kind: 'user_text',
      text: 'Log the event id.',
    });
    expect(started.agentTurnState[agent.id]?.kind).toBe('running');
    vi.advanceTimersByTime(10000);
    const settled = store.getState();
    const replies = (settled.transcripts[agent.id] ?? []).flatMap((event) =>
      event.kind === 'assistant_text' ? [event.delta] : [],
    );
    expect(replies.slice(-2).join('')).toBe('On it. Done soon.');
    expect(settled.agentTurnState[agent.id]?.kind).toBe('idle');
  });
});
