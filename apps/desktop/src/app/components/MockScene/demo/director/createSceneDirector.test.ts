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
import { stageInfoOf } from '../../../../../store/slices/session-view/stageInfoOf';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { RUNNING_CHECKOUT_RETRY, seedBoardScene } from '../../scenes/BoardScene';
import { C08_REVIEWER_ID, C08_RUN_ID, C08_SESSION_ID, seedC08 } from '../../scenes/u25/c08RunSeed';
import { createPlaybackClock } from './createPlaybackClock';
import { createSceneDirector } from './createSceneDirector';
import type { DemoReport } from './demoProtocol';
import type { DemoTimeline } from './directorTypes';
import { boardTimeline } from './boardTimeline';
import { runTimeline } from './runTimeline';

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

  it('settles at once under reduced motion', () => {
    const prepare = vi.fn();
    const { director, reports } = direct({ timeline: { ...LETTERS, prepare }, isSettled: true });
    director.start();
    director.play();
    expect(prepare).not.toHaveBeenCalled();
    expect(draftOf()).toBe('');
    expect(reports.at(-1)).toMatchObject({ type: 'complete', durationMs: 0 });
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

describe('the demo timelines', () => {
  it('moves one board card from running to needs you exactly once', () => {
    seedBoardScene();
    const timeline = boardTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no board timeline');
    }
    const stageOf = (): string => {
      const state = store.getState();
      const session = sessionById(state.sessions, RUNNING_CHECKOUT_RETRY);
      return session === undefined ? 'missing' : stageInfoOf(state, session).stage;
    };
    const stages: string[] = [stageOf()];
    const stop = store.subscribe(() => {
      const stage = stageOf();
      if (stage !== stages.at(-1)) {
        stages.push(stage);
      }
    });
    const { director } = direct({ timeline });
    director.start();
    director.play();
    vi.advanceTimersByTime(30000);
    stop();
    expect(stages).toEqual(['running', 'attention']);
  });

  it('finishes the implementer and runs the reviewer as the next step', () => {
    seedC08({ state: 'working', selection: 'implementer' });
    const timeline = runTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no run timeline');
    }
    const { director } = direct({ timeline });
    director.start();
    director.play();
    vi.advanceTimersByTime(30000);
    const state = store.getState();
    const run = state.sessions
      .find((session) => session.id === C08_SESSION_ID)
      ?.workflowRuns.find((entry) => entry.id === C08_RUN_ID);
    const reviewer = state.sessionPhaseRuns[C08_SESSION_ID]?.find(
      (agent) => agent.id === C08_REVIEWER_ID,
    );
    expect(run?.currentStep).toBe(2);
    expect(reviewer?.status).toBe('completed');
    expect(state.transcripts[C08_REVIEWER_ID]?.at(-1)?.kind).toBe('done');
  });
});
