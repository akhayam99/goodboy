// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { exploreList, exploreOpen } = vi.hoisted(() => ({
  exploreList: vi.fn(),
  exploreOpen: vi.fn(),
}));

vi.mock('../../explore', () => ({
  exploreList,
  exploreOpen,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
    CopyButton: ({ value, label }: { readonly value: string; readonly label: string }) => (
      <button type="button" aria-label={`copy ${label}`}>
        {value}
      </button>
    ),
  };
});

import { ExplorePane } from '.';

const SESSION_ID = 'session-1' as SessionId;

beforeEach(() => {
  exploreList.mockReset();
  exploreOpen.mockReset();
});

afterEach(cleanup);

describe('ExplorePane', () => {
  it('lists returned entries and loads a directory only when expanded', async () => {
    exploreList.mockResolvedValueOnce([
      {
        name: 'docs',
        relPath: 'docs',
        isDir: true,
        sizeBytes: 0,
        modifiedAt: '2026-07-21T10:00:00Z',
      },
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 24,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);
    exploreList.mockResolvedValueOnce([
      {
        name: 'README.md',
        relPath: 'docs/README.md',
        isDir: false,
        sizeBytes: 10,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() =>
      expect(exploreList).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: '',
      }),
    );
    expect(screen.getByText('docs')).toBeDefined();
    expect(screen.getByText('notes.txt')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Expand docs' }));

    await waitFor(() =>
      expect(exploreList).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: 'docs',
      }),
    );
    expect(screen.getByText('README.md')).toBeDefined();
  });

  it('shows listing errors instead of the empty state', async () => {
    exploreList.mockRejectedValueOnce(new Error('io error: permission denied'));

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() =>
      expect(screen.getByText('Could not read this session folder')).toBeDefined(),
    );
    expect(screen.getByText('io error: permission denied')).toBeDefined();
    expect(screen.queryByText('This session folder is empty')).toBeNull();
  });
});
