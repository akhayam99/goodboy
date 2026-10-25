// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { AGENT_HINTS } from './agentHints';
import type { DemoHint } from './demoHintTypes';
import { FIND_HINTS } from './findHints';
import { ORCHESTRATE_HINTS } from './orchestrateHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  document.body.innerHTML = '';
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame'],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type EngineParams = {
  readonly hints: ReadonlyArray<DemoHint>;
};

const engineFor = ({ hints }: EngineParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: () => hints,
    placeOf: () => null,
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'test', settledIds: [] });
  const shown = (): ReadonlyArray<string | null> =>
    reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : []));
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  return { engine, shown, tried };
};

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

type ClickParams = {
  readonly selector: string;
};

const visitorClick = ({ selector }: ClickParams): void => {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  document.querySelector(selector)?.dispatchEvent(event);
};

describe('the guidance hints', () => {
  it('points at the model picker once the agent is idle and credits opening it', async () => {
    document.body.innerHTML =
      '<button type="button" aria-label="Model routing: Claude · Opus 5.5" aria-expanded="false"></button>';
    const { engine, shown, tried } = engineFor({ hints: AGENT_HINTS });
    await frame();
    expect(shown().at(-1)).toBe('agent-model');
    visitorClick({ selector: 'button[aria-label^="Model routing"]' });
    await frame();
    expect(tried()).toEqual(['agent-model']);
    engine.dispose();
  });

  it('credits an open model picker even when the click came from the keyboard path', async () => {
    document.body.innerHTML =
      '<button type="button" aria-label="Model routing: Claude" aria-expanded="false"></button>';
    const { engine, tried } = engineFor({ hints: AGENT_HINTS });
    await frame();
    document
      .querySelector('button[aria-label^="Model routing"]')
      ?.setAttribute('aria-expanded', 'true');
    await frame();
    expect(tried()).toEqual(['agent-model']);
    engine.dispose();
  });

  it('points at the Claude limits before the handoff and credits a click on them', async () => {
    document.body.innerHTML =
      '<button type="button" aria-label="Claude limits. Claude is about to run out"></button>';
    const { engine, shown, tried } = engineFor({ hints: AGENT_HINTS });
    await frame();
    expect(shown().at(-1)).toBe('agent-limits-peek');
    visitorClick({ selector: 'button[aria-label^="Claude limits"]' });
    await frame();
    expect(tried()).toEqual(['agent-limits-peek']);
    engine.dispose();
  });

  it('offers the run report on the finished run and credits a click', async () => {
    const session = aSession({ goal: 'Make the Harborline ledger export reliable' });
    store.setState({
      sessions: [session],
      currentSessionId: session.id,
      focusedWorkflowRunId: { [session.id]: 'demo-run' },
    });
    document.body.innerHTML = '<button type="button" data-testid="create-report-cta"></button>';
    const { engine, shown, tried } = engineFor({ hints: ORCHESTRATE_HINTS });
    await frame();
    expect(shown().at(-1)).toBe('run-report');
    visitorClick({ selector: '[data-testid="create-report-cta"]' });
    await frame();
    expect(tried()).toEqual(['run-report']);
    engine.dispose();
  });

  it('offers New and the report details in the library and credits a click on each', async () => {
    document.body.innerHTML = `
      <button type="button" data-testid="artifact-new" aria-expanded="false"></button>
      <button type="button" data-testid="artifact-drawer-details"></button>
    `;
    const { engine, shown, tried } = engineFor({ hints: FIND_HINTS });
    await frame();
    expect(shown().at(-1)).toBe('library-new');
    visitorClick({ selector: '[data-testid="artifact-new"]' });
    await frame();
    await Promise.resolve();
    vi.advanceTimersByTime(2700);
    expect(shown().at(-1)).toBe('report-details');
    visitorClick({ selector: '[data-testid="artifact-drawer-details"]' });
    await frame();
    expect(tried()).toEqual(['library-new', 'report-details']);
    engine.dispose();
  });
});
