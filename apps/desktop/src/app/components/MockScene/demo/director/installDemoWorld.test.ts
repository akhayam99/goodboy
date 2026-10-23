// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type ArtifactId,
  type PlanId,
  type PlanWithCount,
  type IsoDateTime,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { createSimulatedSend } from './createSimulatedSend';
import { installDemoWorld } from './installDemoWorld';

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
const session = aSession({ goal: 'Show the attempts on each delivery' });
const planner = anAgent({ sessionId: session.id, kind: 'planner', status: 'completed' });
const PLAN_ID = brandId<ArtifactId>({ value: 'demo-test-plan' });
const PLAN: PlanWithCount = {
  id: brandId<PlanId>({ value: PLAN_ID }),
  sessionId: session.id,
  agentId: planner.id,
  title: 'Show the attempts',
  bodyMd: '## Steps',
  status: 'active',
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: 0,
};

const seed = (): void => {
  store.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [planner] },
    sendTurn: createSimulatedSend({ store, reply: 'Revised.', now: () => AT }),
  });
  installDemoWorld({ store });
};

const commentsOf = () => store.getState().artifactComments[session.id] ?? [];

describe('plan comments in the demo', () => {
  it('adds, edits and removes a draft comment', async () => {
    seed();
    const id = await store.getState().addArtifactComment({
      sessionId: session.id,
      artifactId: PLAN_ID,
      revision: 1,
      anchor: { kind: 'part', index: 0, title: 'Steps' },
      body: '  Show a number, not a bar.  ',
    });
    expect(commentsOf()).toMatchObject([
      { id, status: 'draft', body: 'Show a number, not a bar.' },
    ]);
    await store
      .getState()
      .editArtifactComment({ sessionId: session.id, commentId: id ?? '', body: 'A number.' });
    expect(commentsOf()[0]?.body).toBe('A number.');
    await store.getState().removeArtifactComment({ sessionId: session.id, commentId: id ?? '' });
    expect(commentsOf()).toEqual([]);
  });

  it('refuses an empty comment', async () => {
    seed();
    const id = await store.getState().addArtifactComment({
      sessionId: session.id,
      artifactId: PLAN_ID,
      revision: 1,
      anchor: { kind: 'part', index: 0, title: 'Steps' },
      body: '   ',
    });
    expect(id).toBeNull();
    expect(commentsOf()).toEqual([]);
  });

  it('sends drafts to the planner and marks them addressed once it answers', async () => {
    seed();
    await store.getState().addArtifactComment({
      sessionId: session.id,
      artifactId: PLAN_ID,
      revision: 1,
      anchor: { kind: 'part', index: 0, title: 'Steps' },
      body: 'Show a number.',
    });
    const result = await store
      .getState()
      .sendArtifactComments({ sessionId: session.id, plan: PLAN });
    expect(result.kind).toBe('unchanged');
    expect(commentsOf()[0]?.status).toBe('sent');
    expect(store.getState().transcripts[planner.id]?.at(-1)).toMatchObject({ kind: 'user_text' });
    vi.advanceTimersByTime(4000);
    expect(commentsOf()[0]?.status).toBe('addressed');
    expect(store.getState().artifactCommentSends[PLAN_ID]).toBeUndefined();
    expect(
      (await store.getState().sendArtifactComments({ sessionId: session.id, plan: PLAN })).kind,
    ).toBe('empty');
  });
});

describe('diff notes in the demo', () => {
  it('adds a line note, edits it, discards it and brings it back with undo', async () => {
    seed();
    await store
      .getState()
      .addDiffComment(session.id, 'src/ledger/ledgerClient.ts', 'Name it after the event id.', {
        side: 'new',
        lineNumber: 12,
      });
    const [note] = store.getState().diffComments[session.id] ?? [];
    expect(note).toMatchObject({ status: 'open', anchor: { side: 'new', lineNumber: 12 } });
    if (note === undefined) {
      throw new Error('no note');
    }
    await store.getState().editDiffComment(session.id, note.id, 'Use the processor event id.');
    expect(store.getState().diffComments[session.id]?.[0]?.body).toBe(
      'Use the processor event id.',
    );
    await store.getState().discardDiffComments({ sessionId: session.id, ids: [note.id] });
    expect(store.getState().diffComments[session.id]).toEqual([]);
    expect(await store.getState().undoLastOperation({})).toBe(true);
    expect(store.getState().diffComments[session.id]?.map((entry) => entry.id)).toEqual([note.id]);
  });
});
