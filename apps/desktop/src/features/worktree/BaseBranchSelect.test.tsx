// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { listBranchNames } = vi.hoisted(() => ({ listBranchNames: vi.fn() }));

vi.mock('./worktree', () => ({ listBranchNames }));

import { BaseBranchSelect } from './BaseBranchSelect';

const trigger = () => screen.getByRole('combobox', { name: 'Base branch' });
const search = () => screen.getByRole('combobox', { name: 'Search branches' });

describe('BaseBranchSelect', () => {
  beforeEach(() => {
    listBranchNames.mockReset();
    listBranchNames.mockResolvedValue(['main', 'develop', 'release']);
  });
  afterEach(cleanup);

  it('fetches branches only after the popover opens', async () => {
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);

    expect(trigger().textContent).toBe('main');
    expect(listBranchNames).not.toHaveBeenCalled();
    fireEvent.click(trigger());

    await waitFor(() => expect(listBranchNames).toHaveBeenCalledWith({ repoPath: '/repo' }));
  });

  it('filters the fetched branch list', async () => {
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);
    fireEvent.click(trigger());
    await screen.findByRole('option', { name: 'develop' });

    fireEvent.change(search(), { target: { value: 'rel' } });

    expect(screen.getByRole('option', { name: 'release' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'develop' })).toBeNull();
  });

  it('commits an unlisted trimmed branch on Enter', async () => {
    const onCommit = vi.fn();
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={onCommit} />);
    fireEvent.click(trigger());
    await screen.findByRole('option', { name: 'develop' });

    fireEvent.change(search(), { target: { value: '  topic/new  ' } });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('topic/new');
  });

  it('clears an explicit branch to null', () => {
    const onCommit = vi.fn();
    render(<BaseBranchSelect repoPath="/repo" value="develop" onCommit={onCommit} />);
    fireEvent.click(trigger());

    fireEvent.click(screen.getByRole('button', { name: 'Use default' }));

    expect(onCommit).toHaveBeenCalledWith(null);
  });
});
