// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ArtifactSavedCopy as SavedCopy } from '../../hooks/useArtifactSavedCopy';
import { ArtifactSavedCopy } from './ArtifactSavedCopy';

const savedCopy = (over: Partial<SavedCopy> = {}): SavedCopy => ({
  location: { path: '/home/user/.goodboy/workspaces/harborline/artifacts/report', exists: true },
  error: null,
  reveal: vi.fn(),
  openInBrowser: vi.fn(),
  ...over,
});

afterEach(cleanup);

describe('ArtifactSavedCopy', () => {
  it('names the section File and offers both open actions once the file exists', () => {
    const copy = savedCopy();
    render(<ArtifactSavedCopy savedCopy={copy} />);
    expect(screen.getByRole('region', { name: 'File' })).toBeDefined();
    fireEvent.click(screen.getByTestId('artifact-saved-copy-open'));
    expect(copy.openInBrowser).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('artifact-saved-copy-reveal'));
    expect(copy.reveal).toHaveBeenCalledTimes(1);
  });

  it('says the file is still being written when there is nothing on disk yet', () => {
    render(<ArtifactSavedCopy savedCopy={savedCopy({ location: null })} />);
    expect(screen.getByTestId('artifact-saved-copy-path').textContent).toBe('Writing the file…');
    expect(screen.queryByTestId('artifact-saved-copy-open')).toBeNull();
    expect(screen.queryByTestId('artifact-saved-copy-reveal')).toBeNull();
  });

  it('surfaces an error alongside the path', () => {
    render(<ArtifactSavedCopy savedCopy={savedCopy({ error: 'the disk is full' })} />);
    expect(screen.getByRole('alert').textContent).toBe('the disk is full');
  });
});
