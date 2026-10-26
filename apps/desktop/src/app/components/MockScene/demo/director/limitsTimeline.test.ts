// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createPlaybackClock } from './createPlaybackClock';
import { createSceneDirector } from './createSceneDirector';
import { limitsTimeline } from './limitsTimeline';

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

const session = aSession({ goal: 'Stop retried webhooks posting a second credit' });
const tester = anAgent({ sessionId: session.id, kind: 'tester', status: 'completed' });
const now = (): IsoDateTime => brandId<IsoDateTime>({ value: new Date().toISOString() });

const seed = (): void => {
  store.setState({
    sessions: [session],
    currentSessionId: session.id,
    selectedAgentId: { [session.id]: tester.id },
    sessionPhaseRuns: { [session.id]: [tester] },
    transcripts: { [tester.id]: [] },
  });
};

const kindsOf = (): ReadonlyArray<string> =>
  (store.getState().transcripts[tester.id] ?? []).map((event) => event.kind);

describe('the limits handoff', () => {
  it('plays Claude hitting its limit and Codex finishing the same brief once', () => {
    seed();
    const timeline = limitsTimeline({ state: store.getState() });
    if (timeline === null) {
      throw new Error('no limits timeline');
    }
    const director = createSceneDirector({
      timeline,
      store,
      clock: createPlaybackClock({ now: () => Date.now() }),
      isSettled: false,
      now,
      onReport: () => undefined,
    });
    director.start();
    director.play();
    vi.advanceTimersByTime(60000);
    const events = store.getState().transcripts[tester.id] ?? [];
    const note = events.find((event) => event.kind === 'decision_note');
    expect(note?.kind === 'decision_note' ? note.message : '').toContain('retrying on codex');
    expect(kindsOf().filter((kind) => kind === 'user_text')).toHaveLength(1);
    expect(kindsOf().at(-1)).toBe('done');
    expect(store.getState().agentTurnState[tester.id]?.kind).toBe('idle');
  });

  it('hands a visitor message to Codex with an honest sample reply', async () => {
    seed();
    const timeline = limitsTimeline({ state: store.getState() });
    timeline?.setup?.({ store });
    await store
      .getState()
      .sendTurn({ sessionId: session.id, agentId: tester.id, content: 'Run the postings suite.' });
    vi.advanceTimersByTime(60000);
    const replies = (store.getState().transcripts[tester.id] ?? []).flatMap((event) =>
      event.kind === 'assistant_text' ? [event.delta] : [],
    );
    expect(replies.join('')).toContain('Picked that up on Codex');
    expect(kindsOf()).toContain('decision_note');
  });
});
