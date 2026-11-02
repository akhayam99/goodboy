import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextAgentId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from './storyHarness';
import { STREAM_BUDGETS } from './slices/transcripts/streamBudgets';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());

const SHELL_SELECTORS = 300;
const STREAM_SELECTORS = 3;
const TICKS = 50;
const TICK_AGENT = nextAgentId();

let useAppStore: StoryStore;
let shellCalls = 0;
let streamCalls = 0;

type MountParams = {
  readonly useStore: StoryStore;
};

const mountShellSelectors = ({ useStore }: MountParams): void => {
  for (let index = 0; index < SHELL_SELECTORS; index += 1) {
    renderHook(() =>
      useStore((state) => {
        shellCalls += 1;
        return state.sessions.length + state.workspaces.length;
      }),
    );
  }
};

const mountStreamSelectors = ({ useStore }: MountParams): void => {
  for (let index = 0; index < STREAM_SELECTORS; index += 1) {
    renderHook(() =>
      useStore((state) => {
        streamCalls += 1;
        return state.transcripts[TICK_AGENT]?.length ?? 0;
      }),
    );
  }
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  shellCalls = 0;
  streamCalls = 0;
});

afterEach(() => {
  useAppStore.setState({ transcripts: {} });
});

describe('a streaming tick against mounted selectors', () => {
  it('runs no shell selector and stays inside the tick budget', () => {
    mountShellSelectors({ useStore: useAppStore });
    mountStreamSelectors({ useStore: useAppStore });
    const shellBefore = shellCalls;
    const streamBefore = streamCalls;

    const startedAt = performance.now();
    for (let tick = 0; tick < TICKS; tick += 1) {
      act(() => {
        useAppStore.setState((state) => ({
          transcripts: { ...state.transcripts, [TICK_AGENT]: Array.from({ length: tick + 1 }) },
        }));
      });
    }
    const perTickMs = (performance.now() - startedAt) / TICKS;

    expect(shellCalls - shellBefore).toBe(0);
    expect(streamCalls - streamBefore).toBeGreaterThanOrEqual(TICKS * STREAM_SELECTORS);
    expect(perTickMs).toBeLessThan(STREAM_BUDGETS.tickMs);
  });
});
