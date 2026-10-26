// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createPlaybackClock } from './createPlaybackClock';
import { createSceneDirector } from './createSceneDirector';
import type { DemoReport } from './demoProtocol';
import type { DemoTimeline } from './directorTypes';
import { installResolveActions } from './installResolveActions';
import { SESSION_ID as RESOLVE_SESSION_ID, seedResolveScene } from '../../scenes/resolveSeed';

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

const AGENT = brandId<AgentId>({ value: 'demo-test-agent' });

type DirectParams = {
  readonly timeline: DemoTimeline;
  readonly isSettled?: boolean;
};

const direct = ({ timeline, isSettled = false }: DirectParams) => {
  const reports: DemoReport[] = [];
  const director = createSceneDirector({
    timeline,
    store,
    clock: createPlaybackClock({ now: () => Date.now() }),
    isSettled,
    now: () => brandId<IsoDateTime>({ value: new Date().toISOString() }),
    onReport: ({ report }) => reports.push(report),
  });
  return { director, reports };
};

type NoteParams = {
  readonly note: string;
};

const draftOf = (): string => store.getState().agentDraft[AGENT] ?? '';

const note =
  ({ note: text }: NoteParams): DemoTimeline['cues'][number]['apply'] =>
  () =>
    store.setState((state) => ({
      agentDraft: { ...state.agentDraft, [AGENT]: `${state.agentDraft[AGENT] ?? ''}${text}` },
    }));

const LETTERS: DemoTimeline = {
  prepare: () => undefined,
  cues: [
    { atMs: 900, apply: note({ note: 'c' }) },
    { atMs: 300, apply: note({ note: 'a' }) },
    { atMs: 300, apply: note({ note: 'b' }) },
  ],
};

describe('the scene director', () => {
  it('settles a running scene at once when the visitor takes over', () => {
    const { director, reports } = direct({ timeline: LETTERS });
    director.start();
    director.play();
    vi.advanceTimersByTime(400);
    expect(draftOf()).toBe('ab');
    director.settle();
    expect(draftOf()).toBe('abc');
    expect(reports.at(-1)?.type).toBe('complete');
    vi.advanceTimersByTime(2000);
    expect(draftOf()).toBe('abc');
    director.settle();
    expect(reports.filter((report) => report.type === 'complete')).toHaveLength(1);
  });

  it('waits for play, then runs cues by time and declaration order', () => {
    const { director, reports } = direct({ timeline: LETTERS });
    director.start();
    vi.advanceTimersByTime(2000);
    expect(draftOf()).toBe('');
    director.play();
    vi.advanceTimersByTime(1000);
    expect(draftOf()).toBe('abc');
    expect(reports.at(-1)?.type).toBe('complete');
  });

  it('leaves time spent paused out of the playback clock', () => {
    const { director } = direct({ timeline: LETTERS });
    director.start();
    director.play();
    vi.advanceTimersByTime(500);
    director.pause();
    vi.advanceTimersByTime(5000);
    expect(draftOf()).toBe('ab');
    director.play();
    vi.advanceTimersByTime(300);
    expect(draftOf()).toBe('ab');
    vi.advanceTimersByTime(200);
    expect(draftOf()).toBe('abc');
  });

  it('restores the seeded store and tags reports with the new generation on restart', () => {
    const { director, reports } = direct({ timeline: LETTERS });
    director.start();
    director.play();
    vi.advanceTimersByTime(1000);
    director.restart({ generation: 1 });
    expect(draftOf()).toBe('');
    expect(reports.at(-1)).toMatchObject({ type: 'ready', generation: 1 });
    director.play();
    vi.advanceTimersByTime(1000);
    expect(draftOf()).toBe('abc');
  });

  it('lands on the final state at once under reduced motion', () => {
    const prepare = vi.fn();
    const { director, reports } = direct({ timeline: { ...LETTERS, prepare }, isSettled: true });
    director.start();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(draftOf()).toBe('abc');
    director.play();
    expect(reports.at(-1)).toMatchObject({ type: 'complete', durationMs: 0 });
    vi.advanceTimersByTime(2000);
    expect(draftOf()).toBe('abc');
  });

  it('lands on the final state again after a restart under reduced motion', () => {
    const { director } = direct({ timeline: LETTERS, isSettled: true });
    director.start();
    director.restart({ generation: 1 });
    expect(draftOf()).toBe('abc');
  });

  it('passes a hint from a cue to the parent', () => {
    const { director, reports } = direct({
      timeline: {
        prepare: () => undefined,
        cues: [{ atMs: 100, apply: ({ hint }) => hint({ text: 'Open the plan' }) }],
      },
    });
    director.start();
    director.play();
    vi.advanceTimersByTime(100);
    expect(reports.some((report) => report.hint === 'Open the plan')).toBe(true);
  });
});

const STILL: DemoTimeline = { prepare: () => undefined, cues: [] };

describe('a replay during a simulation', () => {
  it('drops a running review fix instead of drafting its reply in the restored scene', async () => {
    seedResolveScene({ expandedThreadId: null });
    const { director } = direct({ timeline: { ...STILL, setup: installResolveActions } });
    director.start();
    const seeded = store.getState();
    await store.getState().spawnAgent(RESOLVE_SESSION_ID, {
      kindOverride: 'resolver',
      sourceThreadIds: ['PRRT_thread_retry_constant'],
      name: 'Resolve: 1 review comment',
      humanPrompt: 'Fix this review comment.',
    });
    vi.advanceTimersByTime(2000);
    director.restart({ generation: 1 });
    vi.advanceTimersByTime(20000);
    const state = store.getState();
    expect(state.sessionResolveQueueItems[RESOLVE_SESSION_ID]).toEqual(
      seeded.sessionResolveQueueItems[RESOLVE_SESSION_ID],
    );
    expect(state.sessionResolveAttempts[RESOLVE_SESSION_ID]).toEqual(
      seeded.sessionResolveAttempts[RESOLVE_SESSION_ID],
    );
    expect(state.sessionPhaseRuns[RESOLVE_SESSION_ID]).toEqual(
      seeded.sessionPhaseRuns[RESOLVE_SESSION_ID],
    );
  });
});
