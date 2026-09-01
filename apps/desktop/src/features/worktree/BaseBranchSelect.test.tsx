// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { listBranchNames } = vi.hoisted(() => ({ listBranchNames: vi.fn() }));

vi.mock('./worktree', () => ({ listBranchNames }));

import { BaseBranchSelect } from './BaseBranchSelect';

describe('BaseBranchSelect', () => {
  beforeEach(() => {
    listBranchNames.mockReset();
    listBranchNames.mockResolvedValue(['main', 'develop', 'release']);
  });
  afterEach(cleanup);

  it('fetches branches only after the popover opens', async () => {
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);

    expect(listBranchNames).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: main' }));

    await waitFor(() => expect(listBranchNames).toHaveBeenCalledWith({ repoPath: '/repo' }));
  });

  it('filters the fetched branch list', async () => {
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: main' }));
    const input = screen.getByRole('combobox', { name: 'Base branch' });
    await screen.findByRole('button', { name: 'develop' });

    fireEvent.change(input, { target: { value: 'rel' } });

    expect(screen.getByRole('button', { name: 'release' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'develop' })).toBeNull();
  });

  it('commits an unlisted trimmed branch on Enter', async () => {
    const onCommit = vi.fn();
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: main' }));
    const input = screen.getByRole('combobox', { name: 'Base branch' });

    fireEvent.change(input, { target: { value: '  topic/new  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('topic/new');
  });

  it('clears an explicit branch to null', () => {
    const onCommit = vi.fn();
    render(<BaseBranchSelect repoPath="/repo" value="develop" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Base branch: develop' }));

    fireEvent.click(screen.getByRole('button', { name: 'Use default' }));

    expect(onCommit).toHaveBeenCalledWith(null);
  });
});
