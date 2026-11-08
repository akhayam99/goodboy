// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { dueInsertionsOf } from '../../../chat/components/ChatView/dueInsertionsOf';
import type { AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { aDelegation, aView, FIXTURE_NOW } from '../../testing/autoViewFixtures';
import { useAutoChildChat } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const SETTLED_AT = FIXTURE_NOW + 60_000;

const END_KEY_PREFIX = 'auto-child-end-';

type ChatParams = {
  readonly state: 'running' | 'settled';
};

const chatOf = ({ state }: ChatParams) => {
  const delegation = {
    ...aDelegation({
      key: 'scout',
      role: 'scout',
      state,
      outcome: state === 'settled' ? 'failed' : null,
    }),
    settledAt: state === 'settled' ? SETTLED_AT : null,
  };
  const agent = anAgent({ id: delegation.childAgentId });
  const tree: AutoTreeOfAgent = {
    kind: 'child',
    view: aView({ phase: 'waiting', delegations: [delegation] }),
    delegation,
  };
  const { result } = renderHook(() => useAutoChildChat({ session: aSession(), agent, tree }));
  return result.current.insertions ?? [];
};

type DueKeysParams = ChatParams & {
  readonly atMs: number;
};

const dueKeysOf = ({ state, atMs }: DueKeysParams) =>
  dueInsertionsOf({
    insertions: chatOf({ state }),
    placed: new Set<string>(),
    beforeMs: atMs,
  }).map((insertion) => insertion.key);

describe('useAutoChildChat', () => {
  it('draws the end of a settled attempt before a later turn, so a later Done never sits above it', () => {
    const keys = dueKeysOf({ state: 'settled', atMs: SETTLED_AT + 5_000 });

    expect(keys.some((key) => key.startsWith(END_KEY_PREFIX))).toBe(true);
  });

  it('keeps the end of a settled attempt under its own turns', () => {
    const keys = dueKeysOf({ state: 'settled', atMs: SETTLED_AT - 5_000 });

    expect(keys.some((key) => key.startsWith(END_KEY_PREFIX))).toBe(false);
  });

  it('keeps the live end of an open attempt after every turn', () => {
    const early = dueKeysOf({ state: 'running', atMs: SETTLED_AT + 5_000 });
    const insertions = chatOf({ state: 'running' });
    const end = insertions.find((insertion) => insertion.key.startsWith(END_KEY_PREFIX));

    expect(early.some((key) => key.startsWith(END_KEY_PREFIX))).toBe(false);
    expect(end?.beforeMs).toBeNull();
  });
});
