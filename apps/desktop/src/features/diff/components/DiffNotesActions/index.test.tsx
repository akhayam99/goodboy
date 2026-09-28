// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DiffComment, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  toggleDrawer: vi.fn(),
  openReview: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({ toggleDrawer: h.toggleDrawer, drawer: null }),
}));
vi.mock('../../../../store/slices/drawer/selectOpenDrawer', () => ({
  selectOpenDrawer: () => null,
}));
vi.mock('../../../review/openReview', () => ({ openReview: h.openReview }));

import { DiffNotesActions } from './index';

const SESSION_ID = 'session-1' as SessionId;
const NOTES = [{ id: 'n-1' }, { id: 'n-2' }] as unknown as ReadonlyArray<DiffComment>;

afterEach(cleanup);

describe('DiffNotesActions', () => {
  it('opens the notes drawer and hands the notes to Review, with no footer bar', () => {
    const { container } = render(<DiffNotesActions sessionId={SESSION_ID} openNotes={NOTES} />);

    fireEvent.click(screen.getByRole('button', { name: '2 notes' }));
    expect(h.toggleDrawer).toHaveBeenCalledWith({
      kind: 'diff-notes',
      sessionId: SESSION_ID,
      payload: {},
    });

    fireEvent.click(screen.getByRole('button', { name: 'Resolve in Review' }));
    expect(h.openReview).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(container.querySelector('footer')).toBeNull();
  });
});
