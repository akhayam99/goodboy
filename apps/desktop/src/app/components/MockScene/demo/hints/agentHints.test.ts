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
import { agentTimeline } from '../director/agentTimeline';
import { createHintEngine } from '../director/createHintEngine';
import { createReplyRuns } from '../director/createReplyRuns';
import { createSimulatedAnswer } from '../director/createSimulatedAnswer';
import { createSimulatedSend } from '../director/createSimulatedSend';
import type { DemoHintReport } from '../director/demoProtocol';
import { AGENT_HINTS } from './agentHints';

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
const RUN = brandId<ProviderRunId>({ value: 'demo-agent-run' });
const session = aSession({ goal: 'Stop retried webhooks posting a second credit' });
const agent = anAgent({ sessionId: session.id, status: 'completed', kind: 'implementer' });
const QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'demo-agent-question' }),
  sessionId: session.id,
  createdByAgentId: agent.id,
  text: 'Should ledger-core keep a posting for a duplicate event, or skip it?',
  suggestedAnswers: ['Skip it', 'Keep it'],
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
    transcripts: {
      [agent.id]: [
        { kind: 'user_text', runId: RUN, text: 'Fix the double credit.', at: AT },
        {
          kind: 'file_edit',
          runId: RUN,
          path: '/mock/applyWebhook.ts',
          editType: 'modify',
          at: AT,
        },
        { kind: 'done', runId: RUN, at: AT },
      ],
    },
  });
};

const CHAT_DOM = `
  <button type="button" aria-label="Claude limits. Claude is about to run out"></button>
  <div data-oq-anchor="${QUESTION.id}"><div role="radiogroup" aria-label="Pick one answer"></div></div>
  <textarea aria-label="Message to the agent"></textarea>
  <button type="button" aria-label="Operations, 3 items" aria-expanded="false">Edited 3 files</button>
`;

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const dwell = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(4600);
};

const visitorClick = (selector: string): void => {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
};

describe('the Work with an agent steps', () => {
  it('walks answer, limits, handoff and files in order, each only after its own action', async () => {
    seed();
    document.body.innerHTML = CHAT_DOM;
    const timeline = agentTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no agent timeline');
    }
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => AGENT_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    const shown = (): string | null =>
      reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : [])).at(-1) ?? null;
    engine.setTrack({ chapterId: 'agent', settledIds: ['agent-issue'] });
    await frame();
    expect(shown()).toBe('agent-answer');

    visitorClick('button[aria-label^="Claude limits"]');
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'true');
    await frame();
    expect(tried()).toEqual([]);
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'false');

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
    await answer(session.id, [{ id: QUESTION.id, text: QUESTION.text, answer: 'Skip it' }], null);
    await frame();
    expect(tried()).toEqual(['agent-answer']);
    await dwell();
    expect(shown()).toBe('agent-limits-peek');
    visitorClick('button[aria-label^="Claude limits"]');
    await frame();
    expect(tried()).toEqual(['agent-answer', 'agent-limits-peek']);
    vi.advanceTimersByTime(10000);
    await dwell();
    expect(shown()).toBe('agent-limits');

    timeline.setup?.({ store });
    await store
      .getState()
      .sendTurn({ sessionId: session.id, agentId: agent.id, content: 'Run the postings suite.' });
    vi.advanceTimersByTime(3000);
    await frame();
    expect(tried().at(-1)).toBe('agent-limits');
    vi.advanceTimersByTime(60000);
    await dwell();
    expect(shown()).toBe('agent-files');
    document
      .querySelector('button[aria-label^="Operations"]')
      ?.setAttribute('aria-expanded', 'true');
    await frame();
    expect(tried()).toEqual(['agent-answer', 'agent-limits-peek', 'agent-limits', 'agent-files']);
    engine.dispose();
  });
});
