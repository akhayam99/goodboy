// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { listBranchNames, repoDefaultBaseBranch } = vi.hoisted(() => ({
  listBranchNames: vi.fn(),
  repoDefaultBaseBranch: vi.fn(),
}));

vi.mock('./worktree', () => ({ listBranchNames, repoDefaultBaseBranch }));

import { BaseBranchSelect } from './BaseBranchSelect';
import { BRANCH_PICKER_MAX_WIDTH } from './branchPicker';

const trigger = () => screen.getByRole('combobox', { name: 'Base branch' });
const search = () => screen.getByRole('combobox', { name: 'Search branches' });

describe('BaseBranchSelect', () => {
  beforeEach(() => {
    listBranchNames.mockReset();
    listBranchNames.mockResolvedValue(['main', 'develop', 'release']);
    repoDefaultBaseBranch.mockReset();
    repoDefaultBaseBranch.mockResolvedValue(null);
  });
  afterEach(cleanup);

  it('fetches branches only after the popover opens', async () => {
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);

    expect(trigger().textContent).toBe('Auto');
    expect(listBranchNames).not.toHaveBeenCalled();
    fireEvent.click(trigger());

    await waitFor(() => expect(listBranchNames).toHaveBeenCalledWith({ repoPath: '/repo' }));
  });

  it('shows the detected default next to Auto', async () => {
    repoDefaultBaseBranch.mockResolvedValue('develop');
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);

    await waitFor(() => expect(trigger().textContent).toBe('Auto · develop'));
    fireEvent.click(trigger());

    const auto = await screen.findByRole('option', { name: /^Auto/ });
    expect(auto.textContent).toContain('Detected from origin/HEAD: develop');
  });

  it('gives the list the branch picker width and cuts a long name in the middle', async () => {
    const long = 'nw/fix-billing-api-settlement-exports-stuck-deliveries';
    listBranchNames.mockResolvedValue(['main', long]);
    render(<BaseBranchSelect repoPath="/repo" value={null} onCommit={vi.fn()} />);
    fireEvent.click(trigger());

    const row = await screen.findByRole('option', { name: long });
    const popup = row.closest('[data-dropdown-portal] > div');
    expect(popup?.getAttribute('style')).toContain(`max-width: ${BRANCH_PICKER_MAX_WIDTH}px`);
    expect(row.querySelector('[data-slot="label-tail"]')?.textContent).toBe('-deliveries');
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

  it('clears an explicit branch to null by picking Auto', async () => {
    const onCommit = vi.fn();
    render(<BaseBranchSelect repoPath="/repo" value="develop" onCommit={onCommit} />);
    fireEvent.click(trigger());

    fireEvent.click(await screen.findByRole('option', { name: /^Auto/ }));

    expect(onCommit).toHaveBeenCalledWith(null);
  });
});
