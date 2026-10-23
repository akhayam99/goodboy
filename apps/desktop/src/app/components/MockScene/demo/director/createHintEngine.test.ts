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
import { AGENT_HINTS } from '../hints/agentHints';
import { ONBOARDING_HINTS } from '../hints/onboardingHints';
import type { DemoHint } from '../hints/demoHintTypes';
import { createHintEngine } from './createHintEngine';
import { createSimulatedAnswer } from './createSimulatedAnswer';
import { createSimulatedSend } from './createSimulatedSend';
import type { DemoHintReport } from './demoProtocol';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const AT = brandId<IsoDateTime>({ value: '2026-10-16T15:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'demo-hint-run' });
const DRAFT = 'Also log the processor event id.';
const session = aSession({ goal: 'Stop payments-api from double-crediting invoices' });
const agent = anAgent({ sessionId: session.id, status: 'completed', kind: 'implementer' });
const QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'demo-hint-question' }),
  sessionId: session.id,
  createdByAgentId: agent.id,
  text: 'Banner or badge?',
  suggestedAnswers: ['Banner', 'Badge'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: AT,
};

const seed = (): void => {
  store.setState({
    sessions: [session],
    currentSessionId: session.id,
    selectedAgentId: { [session.id]: agent.id },
    sessionPhaseRuns: { [session.id]: [agent] },
    sessionOpenQuestions: { [session.id]: [QUESTION] },
    agentDraft: { [agent.id]: DRAFT },
    transcripts: {
      [agent.id]: [
        { kind: 'user_text', runId: RUN, text: 'Fix the double credit.', at: AT },
        { kind: 'file_edit', runId: RUN, path: '/mock/handler.ts', editType: 'modify', at: AT },
        { kind: 'done', runId: RUN, at: AT },
      ],
    },
  });
};

const CHAT_DOM = `
  <button type="button" aria-label="Operations, 3 items" aria-expanded="false">Edited 1 file</button>
  <div data-oq-anchor="${QUESTION.id}"><div role="radiogroup" aria-label="Pick one answer"></div></div>
  <button type="button" aria-label="Send message"></button>
`;

type TrackParams = {
  readonly chapterId: string;
};

type EngineParams = {
  readonly hints: ReadonlyArray<DemoHint>;
};

const engineFor = ({ hints }: EngineParams) => {
  const reports: DemoHintReport[] = [];
  let generation = 0;
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => generation,
    hintsOf: ({ chapterId }: TrackParams) => (chapterId === 'test' ? hints : []),
    onReport: ({ report }) => reports.push(report),
  });
  const shown = (): ReadonlyArray<string | null> =>
    reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : []));
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const setGeneration = (next: number) => {
    generation = next;
  };
  return { engine, reports, shown, tried, setGeneration };
};

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const sendOf = () =>
  createSimulatedSend({ store, reply: 'On it. Done.', now: () => AT, shouldClearDraft: true });

describe('the hint engine', () => {
  it('stays silent until the shell names a track', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, reports } = engineFor({ hints: AGENT_HINTS });
    await frame();
    expect(reports).toEqual([]);
    engine.dispose();
  });

  it('shows the first hint whose control is on screen, in the authored order', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, reports, shown } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('agent-send');
    expect(reports.at(-1)).toMatchObject({
      type: 'anchor',
      rect: { x: 100, y: 200, width: 40, height: 24 },
    });
    document.querySelector('button[aria-label="Send message"]')?.remove();
    await frame();
    expect(shown().at(-1)).toBe('agent-answer');
    engine.dispose();
  });

  it('credits a send only once the reply has finished', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, tried } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    await sendOf()({ sessionId: session.id, agentId: agent.id, content: DRAFT });
    await frame();
    expect(store.getState().agentTurnState[agent.id]?.kind).toBe('running');
    expect(tried()).toEqual([]);
    vi.advanceTimersByTime(10000);
    await frame();
    expect(tried()).toEqual(['agent-send']);
    engine.dispose();
  });

  it('credits an answer through the simulated answer and keeps the unsent draft', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, tried } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    const answer = createSimulatedAnswer({
      store,
      send: createSimulatedSend({
        store,
        reply: 'Thanks.',
        now: () => AT,
        shouldClearDraft: false,
      }),
      now: () => AT,
    });
    await answer(session.id, [{ id: QUESTION.id, text: QUESTION.text, answer: 'Badge' }], null);
    await frame();
    const state = store.getState();
    expect(state.sessionOpenQuestions[session.id]).toEqual([]);
    expect(state.sessionAnsweredQuestions[session.id]?.[0]).toMatchObject({
      status: 'answered',
      userAnswer: 'Badge',
    });
    expect(state.agentDraft[agent.id]).toBe(DRAFT);
    expect(tried()).toEqual(['agent-answer']);
    expect(tried()).not.toContain('agent-send');
    engine.dispose();
  });

  it('credits opening the edited files once their row is expanded', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, tried } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'true');
    await frame();
    expect(tried()).toEqual(['agent-files']);
    engine.dispose();
  });

  it('skips settled hints and offers them again after a reset of the track', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, shown } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: ['agent-send'] });
    await frame();
    expect(shown().at(-1)).toBe('agent-answer');
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('agent-send');
    engine.dispose();
  });

  it('tags reports with the generation and forgets progress made before a restart', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const { engine, reports, tried, setGeneration } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'true');
    await frame();
    expect(tried()).toEqual(['agent-files']);
    setGeneration(1);
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'false');
    engine.reset();
    await frame();
    expect(reports.at(-1)).toMatchObject({ type: 'anchor', generation: 1, hintId: 'agent-send' });
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'true');
    await frame();
    expect(tried()).toEqual(['agent-files', 'agent-files']);
    engine.dispose();
  });

  it('follows the wizard screen by screen and never credits a screen it did not show', async () => {
    document.body.innerHTML = `
      <div aria-label="Goodboy setup" data-step="agents">
        <button type="button" data-demo-anchor="setup-start">Get started</button>
        <button type="button" data-demo-anchor="setup-continue">Continue</button>
      </div>
    `;
    const { engine, shown, tried } = engineFor({ hints: ONBOARDING_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('setup-agents');
    document.querySelector('[aria-label="Goodboy setup"]')?.setAttribute('data-step', 'workspace');
    await frame();
    expect(tried()).toEqual(['setup-agents']);
    expect(shown().at(-1)).toBeNull();
    engine.dispose();
  });
});
