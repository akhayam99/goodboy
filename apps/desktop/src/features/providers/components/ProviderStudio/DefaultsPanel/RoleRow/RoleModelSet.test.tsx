import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { getModelProvider } from '@goodboy/core';
import { RoleModelSet } from './RoleModelSet';

type Choice = Parameters<Parameters<typeof RoleModelSet>[0]['onAdd']>[0];

const renderSet = (onAdd: (choice: Choice) => void) =>
  render(
    <RoleModelSet
      label="Planner"
      title="Models for planning"
      entries={[]}
      auto={{ provider: 'anthropic', model: 'claude-sonnet-4-6', effort: 'medium' }}
      connectedProviders={['anthropic', 'cursor']}
      disabled={false}
      onAdd={onAdd}
      onRemove={vi.fn()}
      onMove={vi.fn()}
    />,
  );

const openPicker = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
  return screen.getByRole('group', { name: 'Planner add model' });
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('RoleModelSet', () => {
  it('adds nothing while the provider and the model are still being picked', () => {
    const onAdd = vi.fn<(choice: Choice) => void>();
    renderSet(onAdd);

    const picker = openPicker();
    fireEvent.click(within(picker).getByRole('button', { name: 'Cursor' }));
    fireEvent.click(
      within(within(picker).getByRole('group', { name: 'Model' })).getAllByRole('button')[1]!,
    );

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds the picked model once, under the provider it was picked in', () => {
    const onAdd = vi.fn<(choice: Choice) => void>();
    renderSet(onAdd);

    const picker = openPicker();
    fireEvent.click(within(picker).getByRole('button', { name: 'Cursor' }));
    fireEvent.click(
      within(within(picker).getByRole('group', { name: 'Model' })).getAllByRole('button')[1]!,
    );
    fireEvent.click(within(picker).getByRole('button', { name: /^Add (?!provider$)/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [choice] = onAdd.mock.calls[0] ?? [];
    expect(choice?.providerId).toBe('cursor');
    expect(getModelProvider(choice?.model ?? '')).toBe('cursor');
  });

  it('adds the version the user lands on, not every step on the way', () => {
    const onAdd = vi.fn<(choice: Choice) => void>();
    renderSet(onAdd);

    const picker = openPicker();
    fireEvent.click(within(within(picker).getByRole('group', { name: 'Model' })).getByText('Opus'));
    fireEvent.click(within(within(picker).getByRole('group', { name: 'Version' })).getByText('5'));
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(within(picker).getByRole('button', { name: 'Add Opus 5' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({ providerId: 'anthropic', model: 'claude-opus-5' });
  });

  it('keeps Add disabled while Auto is the pick on show', () => {
    const onAdd = vi.fn<(choice: Choice) => void>();
    renderSet(onAdd);

    const picker = openPicker();

    expect(within(picker).getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
  });

  it('closes on Auto without adding anything', () => {
    const onAdd = vi.fn<(choice: Choice) => void>();
    renderSet(onAdd);

    const picker = openPicker();
    fireEvent.click(within(picker).getByRole('button', { name: /^Auto/ }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Planner add model' })).toBeNull();
  });
});
