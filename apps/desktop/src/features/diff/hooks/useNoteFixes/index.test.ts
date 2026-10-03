// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  NOTE_IDS,
  seedResolveNotes,
} from '../../../../app/components/MockScene/scenes/resolveNotesSeed';
import type { IsoDateTime } from '@goodboy/types';
import { useNoteFixes } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveNotes();
});

afterEach(cleanup);

describe('useNoteFixes', () => {
  it('reads only the notes, their queue and their attempts, never the pull request rows', () => {
    const { result } = renderHook(() => useNoteFixes({ sessionId: SESSION_ID }));
    const before = result.current;

    act(() => {
      const github = useAppStore.getState().sessionGithub[SESSION_ID];
      if (github === undefined) {
        throw new Error('the scene has no pull request');
      }
      useAppStore.setState({
        sessionGithub: {
          [SESSION_ID]: { ...github, detailFetchedAt: '2026-09-04T15:00:00.000Z' as IsoDateTime },
        },
        reviewSourceKeys: { [SESSION_ID]: 'local' },
      });
    });

    expect(result.current).toBe(before);
    expect(result.current.find((fix) => fix.note.id === NOTE_IDS.working)?.isLocked).toBe(true);
  });
});
