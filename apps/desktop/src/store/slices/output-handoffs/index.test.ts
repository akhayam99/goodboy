import { beforeAll, describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { nextAgentId } from '@goodboy/types/testing';
import type { AppStore } from '../../store';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import type { OutputHandoff } from '../../../shared/utils/outputHandoff';
import { createOutputHandoffsSlice } from './index';

const AGENT_ID = nextAgentId();
const OTHER_ID = nextAgentId();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const handoffOf = (id: string): OutputHandoff => ({
  id,
  title: `Output of ${id}`,
  fileName: `${id}.txt`,
  text: id,
  isTruncated: false,
});

const harness = () =>
  createStore<AppStore>((set, get) => ({
    ...useAppStore.getInitialState(),
    ...createOutputHandoffsSlice({ set, get }),
  }));

describe('output handoffs slice', () => {
  it('queues handoffs per agent in order', () => {
    const store = harness();
    store.getState().queueOutputHandoff({ agentId: AGENT_ID, handoff: handoffOf('a') });
    store.getState().queueOutputHandoff({ agentId: AGENT_ID, handoff: handoffOf('b') });
    store.getState().queueOutputHandoff({ agentId: OTHER_ID, handoff: handoffOf('c') });
    expect(store.getState().outputHandoffs[AGENT_ID]?.map((handoff) => handoff.id)).toEqual([
      'a',
      'b',
    ]);
    expect(store.getState().outputHandoffs[OTHER_ID]?.map((handoff) => handoff.id)).toEqual(['c']);
  });

  it('consumes only the handoffs it was given', () => {
    const store = harness();
    store.getState().queueOutputHandoff({ agentId: AGENT_ID, handoff: handoffOf('a') });
    store.getState().queueOutputHandoff({ agentId: AGENT_ID, handoff: handoffOf('b') });
    store.getState().consumeOutputHandoffs({ agentId: AGENT_ID, ids: ['a'] });
    expect(store.getState().outputHandoffs[AGENT_ID]?.map((handoff) => handoff.id)).toEqual(['b']);
  });

  it('leaves the state alone when nothing matches', () => {
    const store = harness();
    store.getState().queueOutputHandoff({ agentId: AGENT_ID, handoff: handoffOf('a') });
    const before = store.getState().outputHandoffs;
    store.getState().consumeOutputHandoffs({ agentId: AGENT_ID, ids: ['missing'] });
    store.getState().consumeOutputHandoffs({ agentId: OTHER_ID, ids: ['a'] });
    expect(store.getState().outputHandoffs).toBe(before);
  });
});
