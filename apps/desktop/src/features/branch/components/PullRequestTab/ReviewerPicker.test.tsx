// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { PullRequestPerson } from '@goodboy/types';
import { ReviewerPicker } from './ReviewerPicker';

const person = (login: string): PullRequestPerson => ({ login, name: null, avatarUrl: null });

const searchMock = vi.fn(async (): Promise<ReadonlyArray<PullRequestPerson>> => [
  person('octocat'),
  person('hubot'),
]);

const renderPicker = ({ onAdd = vi.fn() }: { readonly onAdd?: () => void } = {}) => {
  render(
    <ReviewerPicker
      search={searchMock}
      exclude={new Set<string>()}
      openEventName="goodboy:test-request-review"
      onAdd={onAdd}
    />,
  );
  return { onAdd };
};

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /request review/i }));

beforeEach(() => {
  searchMock.mockClear();
});
afterEach(cleanup);

describe('ReviewerPicker', () => {
  it('lists the repo collaborators once opened', async () => {
    renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    expect(screen.getByText('hubot')).toBeDefined();
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves out someone who already reviews', async () => {
    render(
      <ReviewerPicker
        search={searchMock}
        exclude={new Set(['octocat'])}
        openEventName="goodboy:test-request-review"
        onAdd={vi.fn()}
      />,
    );
    openPanel();
    await waitFor(() => expect(screen.getByText('hubot')).toBeDefined());
    expect(screen.queryByText('octocat')).toBeNull();
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

  it('closes on Escape', async () => {
    renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('filter collaborators')).toBeNull();
  });

  it('escapes clipping ancestors through a fixed body portal', async () => {
    renderPicker();
    openPanel();
    const panel = await screen.findByPlaceholderText('filter collaborators');
    const popup = panel.closest('div.fixed');
    expect(popup?.className).toContain('z-popover');
    expect(popup?.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
  });

  it('closes on a mousedown outside the picker', async () => {
    renderPicker();
    openPanel();
    await waitFor(() => expect(screen.getByText('octocat')).toBeDefined());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('filter collaborators')).toBeNull();
  });
});
