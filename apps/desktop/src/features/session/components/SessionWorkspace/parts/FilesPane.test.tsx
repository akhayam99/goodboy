// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const SESSION_ID = 'ses-1' as SessionId;

vi.mock('./FileVersionsPane', () => ({
  FileVersionsPane: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="file-versions">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

import { FilesPane } from './FilesPane';

afterEach(cleanup);

describe('FilesPane', () => {
  it('shows the file versions pane with its own close control for a session without a branch', () => {
    render(<FilesPane sessionId={SESSION_ID} sessionDir="/tmp/wt" onClose={() => undefined} />);

    expect(screen.getByTestId('file-versions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('explains itself when the session directory is missing', () => {
    render(<FilesPane sessionId={SESSION_ID} sessionDir={null} onClose={() => undefined} />);

    expect(screen.getByText('Session directory missing')).toBeTruthy();
  });
});
