// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { CTX_SESSION_ID } from '../../../../app/components/MockScene/scenes/brand/contextBase';
import { NOTE_IDS } from '../../../../app/components/MockScene/scenes/resolveNotesSeed';
import { seedNotesScene } from '../../../../app/components/MockScene/scenes/u23/notesSeed';
import { useDiffNotes } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedNotesScene({ variant: 'all' });
});

afterEach(cleanup);

const read = () =>
  renderHook(() => useDiffNotes({ sessionId: CTX_SESSION_ID }), { wrapper: ToastProvider });

describe('useDiffNotes', () => {
  it('draws every note as a note thread of the user, never a host thread', () => {
    const { result } = read();

    expect(result.current.threads.length).toBeGreaterThan(0);
    expect(result.current.threads.every((thread) => thread.source === 'note')).toBe(true);
    expect(result.current.threads.every((thread) => thread.host === null)).toBe(true);
    expect(result.current.threads.every((thread) => thread.author === 'You')).toBe(true);
  });

  it('lets an open note be edited and sends the new text through the store', () => {
    const editDiffComment = vi.fn(async () => undefined);
    useAppStore.setState({ editDiffComment });
    const { result } = read();

    const open = result.current.threads.find((thread) => thread.id === NOTE_IDS.open);
    expect(open?.canEdit).toBe(true);
    void result.current.onEdit?.(NOTE_IDS.open, 'Cap the backoff at 30 seconds');

    expect(editDiffComment).toHaveBeenCalledWith(
      CTX_SESSION_ID,
      NOTE_IDS.open,
      'Cap the backoff at 30 seconds',
    );
  });

  it('hands the edit promise back so the composer can await a failure', async () => {
    const editDiffComment = vi.fn(async () => {
      throw new Error('Database is locked');
    });
    useAppStore.setState({ editDiffComment });
    const { result } = read();

    await expect(result.current.onEdit?.(NOTE_IDS.open, 'Cap it')).rejects.toThrow(
      'Database is locked',
    );
  });

  it('keeps a note a fixer is working on from being edited', () => {
    const { result } = read();

    const working = result.current.threads.find((thread) => thread.id === NOTE_IDS.working);
    expect(working?.canEdit).toBe(false);
    expect(working?.lockReason).not.toBeNull();
  });

  it('leaves a done note without Edit', () => {
    const { result } = read();

    const done = result.current.threads.find((thread) => thread.id === NOTE_IDS.done);
    expect(done?.isResolved).toBe(true);
    expect(done?.canEdit).toBe(false);
  });
});
