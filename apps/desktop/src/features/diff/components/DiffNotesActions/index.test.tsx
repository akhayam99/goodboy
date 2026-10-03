// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { selectedReviewEntryOf } from '../../../../store/slices/review-source/activeReviewSource';
import { SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  NOTE_IDS,
  seedResolveNotes,
} from '../../../../app/components/MockScene/scenes/resolveNotesSeed';
import { noteThreadId } from '../../../resolve/notes/noteThread';
import { reviewRowsOf } from '../../../resolve/reviewRows';
import { useNoteFixes } from '../../hooks/useNoteFixes';
import { DiffNotesActions } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveNotes();
});

afterEach(cleanup);

const Actions = () => {
  const fixes = useNoteFixes({ sessionId: SESSION_ID });
  return <DiffNotesActions sessionId={SESSION_ID} fixes={fixes} />;
};

describe('DiffNotesActions', () => {
  it('counts the notes still in play and opens the notes drawer', () => {
    render(<Actions />);

    fireEvent.click(screen.getByRole('button', { name: '6 notes' }));

    expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('diff-notes');
  });

  it('opens Review on your notes even when a pull request is open', async () => {
    render(<Actions />);
    expect(
      selectedReviewEntryOf({ state: useAppStore.getState(), sessionId: SESSION_ID }).kind,
    ).toBe('github');

    fireEvent.click(screen.getByRole('button', { name: 'Open in Review' }));

    await waitFor(() =>
      expect(
        selectedReviewEntryOf({ state: useAppStore.getState(), sessionId: SESSION_ID }).kind,
      ).toBe('local'),
    );
    const origins = reviewRowsOf({ state: useAppStore.getState(), sessionId: SESSION_ID }).map(
      (row) => row.thread.originKind,
    );
    expect(origins.length).toBeGreaterThan(0);
    expect(new Set(origins)).toEqual(new Set(['diff_comment']));
  });

  it('opens the launch strip for the notes nobody started, without starting anything', () => {
    render(<Actions />);

    fireEvent.click(screen.getByRole('button', { name: 'Fix 2 notes' }));

    expect(useAppStore.getState().diffNoteLaunch[SESSION_ID]).toEqual([
      noteThreadId({ noteId: NOTE_IDS.open }),
      noteThreadId({ noteId: NOTE_IDS.openSecond }),
    ]);
    expect(useAppStore.getState().sessionResolveBatches[SESSION_ID] ?? []).toEqual([]);
  });
});
