// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { collaboratorsMock } = vi.hoisted(() => ({
  collaboratorsMock: vi.fn(async (): Promise<ReadonlyArray<string>> => ['octocat', 'hubot']),
}));

vi.mock('../../github', () => ({ ghRepoCollaborators: collaboratorsMock }));
vi.mock('../../../../store', () => ({ useCurrentWorkspace: () => ({ id: 'ws-1' }) }));

import { ReviewerPicker } from './ReviewerPicker';

const renderPicker = ({ onAdd = vi.fn() }: { readonly onAdd?: () => void } = {}) => {
  render(<ReviewerPicker workspaceRoot="/tmp/repo" exclude={new Set<string>()} onAdd={onAdd} />);
  return { onAdd };
};

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /request review/i }));

beforeEach(() => {
  collaboratorsMock.mockClear();
});
afterEach(cleanup);

describe('ReviewerPicker', () => {
  it('lists the repo collaborators once opened', async () => {
    renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    expect(screen.getByText('hubot')).toBeDefined();
  });

  it('filters the collaborators by the typed query', async () => {
    renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText('filter collaborators'), {
      target: { value: 'hub' },
    });
    expect(screen.queryByText('octocat')).toBeNull();
    expect(screen.getByText('hubot')).toBeDefined();
  });

  it('adds the picked login and closes', async () => {
    const { onAdd } = renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    fireEvent.click(screen.getByText('octocat'));
    expect(onAdd).toHaveBeenCalledWith(['octocat']);
    expect(screen.queryByPlaceholderText('filter collaborators')).toBeNull();
  });

  it('closes on a mousedown outside the picker', async () => {
    renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('filter collaborators')).toBeNull();
  });
});
