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
import { ORCHESTRATE_HINTS } from '../hints/orchestrateHints';
import type { DemoHint } from '../hints/demoHintTypes';
import { setupPlace } from '../hints/setupPlace';
import { createHintEngine } from './createHintEngine';
import { createSimulatedAnswer } from './createSimulatedAnswer';
import { createSimulatedSend } from './createSimulatedSend';
import { createReplyRuns } from './createReplyRuns';
import type { DemoHintReport } from './demoProtocol';
import { createPlaybackClock } from './createPlaybackClock';
import { createSceneDirector } from './createSceneDirector';
import { limitsTimeline } from './limitsTimeline';
import { AUTO_ROOT_ID, AUTO_SESSION, autoSceneOf } from '../../scenes/u24/autoSceneSeed';
import { seedC07 } from '../../scenes/u25/c07/c07AutoSeed';
import { autoTimeline } from './autoTimeline';

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

type GenerationParams = {
  readonly next: number;
};

const engineFor = ({ hints }: EngineParams) => {
  const reports: DemoHintReport[] = [];
  let generation = 0;
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => generation,
    hintsOf: ({ chapterId }: TrackParams) => (chapterId === 'test' ? hints : []),
    placeOf: setupPlace,
    onReport: ({ report }) => reports.push(report),
  });
  const shown = (): ReadonlyArray<string | null> =>
    reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : []));
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const places = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'place' ? [report.place] : []));
  const setGeneration = ({ next }: GenerationParams) => {
    generation = next;
  };
  return { engine, reports, shown, tried, places, setGeneration };
};

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const sendOf = () =>
  createSimulatedSend({
    store,
    reply: 'On it. Done.',
    now: () => AT,
    shouldClearDraft: true,
    runs: createReplyRuns(),
  });

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
        runs: createReplyRuns(),
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
    setGeneration({ next: 1 });
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

  it('reports the wizard screen once per change so the shell can follow it', async () => {
    document.body.innerHTML = `<div aria-label="Goodboy setup" data-step="welcome"></div>`;
    const { engine, places } = engineFor({ hints: ONBOARDING_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    document.querySelector('[aria-label="Goodboy setup"]')?.setAttribute('data-step', 'agents');
    await frame();
    await frame();
    expect(places()).toEqual(['welcome', 'agents']);
    engine.dispose();
  });

  it('asks for Create once a folder is chosen, then credits the workspace', async () => {
    document.body.innerHTML = `
      <div aria-label="Goodboy setup" data-step="workspace">
        <button type="button" data-demo-anchor="setup-choose-folder">Choose folder</button>
      </div>
    `;
    const { engine, shown, tried } = engineFor({ hints: ONBOARDING_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('setup-workspace');
    const wizard = document.querySelector('[aria-label="Goodboy setup"]');
    if (wizard === null) {
      throw new Error('missing wizard');
    }
    wizard.innerHTML = '<button type="submit" data-demo-anchor="setup-create">Create</button>';
    await frame();
    expect(shown().at(-1)).toBe('setup-create');
    expect(tried()).toEqual(['setup-workspace']);
    wizard.setAttribute('data-step', 'tools');
    await frame();
    expect(tried()).toEqual(['setup-workspace', 'setup-create']);
    engine.dispose();
  });

  it('credits the first task when its session opens and points on once it answered', async () => {
    document.body.innerHTML = `
      <div aria-label="Goodboy setup" data-step="first-session">
        <button type="button" data-demo-anchor="setup-first-start">Start</button>
      </div>
    `;
    const { engine, shown, tried } = engineFor({ hints: ONBOARDING_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(shown().at(-1)).toBe('setup-first-start');
    document.body.innerHTML = '<textarea aria-label="Message to the agent"></textarea>';
    seed();
    await frame();
    expect(tried()).toEqual(['setup-first-start']);
    expect(shown().at(-1)).toBe('setup-done');
    engine.dispose();
  });

  it('counts from when a hint became eligible, not from a store that was still loading', async () => {
    document.body.innerHTML = CHAT_DOM;
    const { engine, tried } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    seed();
    store.setState({
      sessionAnsweredQuestions: {
        [session.id]: [
          {
            ...QUESTION,
            id: brandId<OpenQuestionId>({ value: 'demo-hint-answered' }),
            status: 'answered',
            userAnswer: 'Banner',
          },
        ],
      },
    });
    await frame();
    expect(tried()).toEqual([]);
    engine.dispose();
  });

  it('starts Auto only for a new turn, not for the turns its scene seeds late', async () => {
    document.body.innerHTML = '<textarea aria-label="Start a run"></textarea>';
    const { engine, tried } = engineFor({ hints: ORCHESTRATE_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    const scene = autoSceneOf({ state: 'done' });
    store.setState({
      sessions: [AUTO_SESSION],
      currentSessionId: AUTO_SESSION.id,
      autoTreeViews: { [AUTO_SESSION.id]: [scene.view] },
      transcripts: { [AUTO_ROOT_ID]: scene.events },
    });
    await frame();
    expect(tried()).toEqual([]);
    store.setState((current) => ({
      transcripts: {
        [AUTO_ROOT_ID]: [
          ...(current.transcripts[AUTO_ROOT_ID] ?? []),
          {
            kind: 'user_text',
            runId: brandId<ProviderRunId>({ value: 'demo-hint-started' }),
            text: 'Check ledger-core too.',
            at: AT,
          },
        ],
      },
    }));
    await frame();
    expect(tried()).toEqual(['auto-start']);
    engine.dispose();
  });

  it('credits nothing while the Auto start scene loads cold and plays its own cues', async () => {
    seedC07({ state: 'working', place: 'start' });
    document.body.innerHTML = '<textarea aria-label="Start a run"></textarea>';
    const timeline = autoTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no Auto timeline');
    }
    const director = createSceneDirector({
      timeline,
      store,
      clock: createPlaybackClock({ now: () => Date.now() }),
      isSettled: false,
      now: () => AT,
      onReport: () => undefined,
    });
    const { engine, tried } = engineFor({ hints: ORCHESTRATE_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    director.start();
    director.play();
    await frame();
    vi.advanceTimersByTime(60000);
    await frame();
    expect(tried()).toEqual([]);
    director.dispose();
    engine.dispose();
  });

  it('credits the limits handoff for a visitor message, not for the scripted one', async () => {
    seed();
    store.setState({ sessionOpenQuestions: {}, agentDraft: {}, transcripts: { [agent.id]: [] } });
    document.body.innerHTML = '<textarea aria-label="Message to the agent"></textarea>';
    const timeline = limitsTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no limits timeline');
    }
    const director = createSceneDirector({
      timeline,
      store,
      clock: createPlaybackClock({ now: () => Date.now() }),
      isSettled: false,
      now: () => AT,
      onReport: () => undefined,
    });
    const { engine, tried } = engineFor({ hints: AGENT_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    director.start();
    director.play();
    vi.advanceTimersByTime(60000);
    await frame();
    expect(tried()).toEqual([]);
    await store
      .getState()
      .sendTurn({ sessionId: session.id, agentId: agent.id, content: 'Run the postings suite.' });
    vi.advanceTimersByTime(60000);
    await frame();
    expect(tried()).toEqual(['agent-limits']);
    director.dispose();
    engine.dispose();
  });

  it('flags a control scrolled out of view and scrolls it in on request', async () => {
    document.body.innerHTML = `
      <div aria-label="Goodboy setup" data-step="tools">
        <button type="button" data-demo-anchor="setup-continue">Continue</button>
      </div>
    `;
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.tagName === 'BUTTON'
        ? new DOMRect(100, window.innerHeight + 400, 40, 24)
        : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    });
    const { engine, reports } = engineFor({ hints: ONBOARDING_HINTS });
    engine.setTrack({ chapterId: 'test', settledIds: [] });
    await frame();
    expect(reports.at(-1)).toMatchObject({
      type: 'anchor',
      hintId: 'setup-tools',
      rect: null,
      isOffscreen: true,
    });
    engine.reveal({ hintId: 'setup-tools' });
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
    engine.dispose();
  });
});
