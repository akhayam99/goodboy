// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { noteThreadId } from '../../../resolve/notes/noteThread';
import { DiffNotesDrawer } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveNotes();
});

afterEach(cleanup);

const groupNames = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('section[data-group]')).map(
    (section) => section.getAttribute('aria-label') ?? '',
  );

const noteRow = (noteId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-note-id="${noteId}"]`);
  if (row === null) {
    throw new Error(`no row for ${noteId}`);
  }
  return row;
};

describe('DiffNotesDrawer', () => {
  it('groups the notes by state with the words Review uses, done folded', () => {
    render(<DiffNotesDrawer sessionId={SESSION_ID} onClose={() => undefined} />);

    expect(groupNames()).toEqual([
      'Not started',
      'Working',
      'Needs you',
      'Ready to accept',
      'Failed',
      'Done',
    ]);
    const done = screen.getByRole('button', { name: /Done/ });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector(`[data-note-id="${NOTE_IDS.done}"]`)).toBeNull();
    fireEvent.click(done);
    noteRow(NOTE_IDS.done);
  });

  it('shows file and line, the model and commit style, and the next action per note', () => {
    render(<DiffNotesDrawer sessionId={SESSION_ID} onClose={() => undefined} />);

    const working = noteRow(NOTE_IDS.working);
    within(working).getByText('retryPolicy.ts:58');
    within(working).getByText(/Sonnet 5\.5 · Medium · New commit/);
    within(working).getByRole('button', { name: 'Open brief' });

    fireEvent.click(within(noteRow(NOTE_IDS.open)).getByRole('button', { name: 'Fix' }));
    expect(useAppStore.getState().diffNoteLaunch[SESSION_ID]).toEqual([
      noteThreadId({ noteId: NOTE_IDS.open }),
    ]);
  });
});
