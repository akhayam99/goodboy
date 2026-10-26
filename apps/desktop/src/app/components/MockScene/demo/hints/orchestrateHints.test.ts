// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { AUTO_ROOT_ID, AUTO_SESSION, autoSceneOf } from '../../scenes/u24/autoSceneSeed';
import { seedC07 } from '../../scenes/u25/c07/c07AutoSeed';
import { autoTimeline } from '../director/autoTimeline';
import { createHintEngine } from '../director/createHintEngine';
import { createPlaybackClock } from '../director/createPlaybackClock';
import { createSceneDirector } from '../director/createSceneDirector';
import type { DemoHintReport } from '../director/demoProtocol';
import { ORCHESTRATE_HINTS } from './orchestrateHints';

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

const frame = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(20);
};

const dwell = async (): Promise<void> => {
  await Promise.resolve();
  vi.advanceTimersByTime(2700);
};

const engineFor = () => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: () => ORCHESTRATE_HINTS,
    onReport: ({ report }) => reports.push(report),
  });
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const shown = (): string | null =>
    reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : [])).at(-1) ?? null;
  return { engine, tried, shown };
};

const ASK = '<textarea aria-label="Start a run"></textarea>';

describe('the Orchestrate steps', () => {
  it('starts Auto only for a new turn, not for the turns its scene seeds late', async () => {
    document.body.innerHTML = ASK;
    const { engine, tried } = engineFor();
    engine.setTrack({ chapterId: 'orchestrate', settledIds: [] });
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
            text: 'Stop retried webhooks posting a second credit.',
            at: AT,
          },
        ],
      },
    }));
    await frame();
    expect(tried()).toEqual(['auto-start']);
    engine.dispose();
  });

  it('credits nothing while the Auto start scene loads cold, then walks goal, approval and a helper', async () => {
    seedC07({ state: 'working', place: 'start' });
    document.body.innerHTML = ASK;
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
    const { engine, tried, shown } = engineFor();
    engine.setTrack({ chapterId: 'orchestrate', settledIds: [] });
    director.start();
    director.play();
    await frame();
    vi.advanceTimersByTime(60000);
    await frame();
    expect(tried()).toEqual([]);
    expect(shown()).toBe('auto-start');

    await store
      .getState()
      .spawnAgent(AUTO_SESSION.id, {
        initialPrompt: 'Stop retried webhooks posting a second credit',
      });
    await frame();
    expect(tried()).toEqual(['auto-start']);

    document.body.innerHTML = '<button data-demo-anchor="auto-approve">Approve plan</button>';
    vi.advanceTimersByTime(20000);
    await dwell();
    expect(shown()).toBe('auto-approve');
    await store.getState().sendTurn({
      sessionId: AUTO_SESSION.id,
      agentId: AUTO_ROOT_ID,
      content: 'Approved plan v1.',
    });
    await frame();
    expect(tried()).toEqual(['auto-start', 'auto-approve']);

    document.body.innerHTML = `
      <ul aria-label="Delegations">
        <li data-delegation><span><button aria-label="Open Planner">Open</button></span></li>
        <li data-delegation><span><button aria-label="Open Ledger implementer">Open</button></span></li>
      </ul>
    `;
    await dwell();
    expect(shown()).toBe('auto-child');
    store.getState().openDrawer({
      kind: 'auto-child',
      sessionId: AUTO_SESSION.id,
      payload: { agentId: AUTO_ROOT_ID },
    });
    await frame();
    expect(tried()).toEqual(['auto-start', 'auto-approve', 'auto-child']);
    director.dispose();
    engine.dispose();
  });
});
