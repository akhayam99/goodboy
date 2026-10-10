import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { getModelProvider } from '@goodboy/core';
import type { ProviderId, TaskModelPreference } from '@goodboy/types';
import { nextWorkspaceId } from '@goodboy/types/testing';
import { TaskModelRow } from './index';

const WORKSPACE_ID = nextWorkspaceId();

const CONNECTED = ['anthropic', 'cursor'] satisfies ReadonlyArray<ProviderId>;

type RenderParams = {
  readonly preference: TaskModelPreference | null;
  readonly onChange: (preference: TaskModelPreference | null) => void;
};

const renderRow = ({ preference, onChange }: RenderParams) =>
  render(
    <TaskModelRow
      workspaceId={WORKSPACE_ID}
      task="summarizer"
      label="Step summaries"
      help="writes the step summary"
      preference={preference}
      connectedProviderIds={CONNECTED}
      disabled={false}
      onChange={onChange}
    />,
  );

const openPicker = () =>
  fireEvent.click(screen.getByRole('button', { name: /^Step summaries routing:/ }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('TaskModelRow', () => {
  it('never pairs a model with a provider that does not own it', () => {
    const onChange = vi.fn<(preference: TaskModelPreference | null) => void>();
    renderRow({ preference: { providerId: 'anthropic', model: 'claude-sonnet-4-6' }, onChange });

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));

    expect(onChange.mock.calls.length).toBeGreaterThan(0);
    for (const [preference] of onChange.mock.calls) {
      expect(preference?.providerId).toBe('cursor');
      expect(getModelProvider(preference?.model ?? '')).toBe('cursor');
    }
  });

  it('keeps a local provider choice while the task runs on automatic', () => {
    const onChange = vi.fn<(preference: TaskModelPreference | null) => void>();
    renderRow({ preference: null, onChange });

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));

    expect(onChange.mock.calls.at(-1)?.[0]?.providerId).toBe('cursor');
  });

  it('hands the provider, the model and the clamped effort over in one change', () => {
    const onChange = vi.fn<(preference: TaskModelPreference | null) => void>();
    renderRow({
      preference: { providerId: 'anthropic', model: 'claude-sonnet-4-6', effort: 'high' },
      onChange,
    });

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [preference] = onChange.mock.calls[0] ?? [];
    expect(preference?.providerId).toBe('cursor');
    expect(getModelProvider(preference?.model ?? '')).toBe('cursor');
  });

  it('saves the effort the picker showed when the requested one only looked lower', () => {
    const onChange = vi.fn<(preference: TaskModelPreference | null) => void>();
    render(
      <TaskModelRow
        workspaceId={WORKSPACE_ID}
        task="summarizer"
        label="Step summaries"
        help="writes the step summary"
        preference={{ providerId: 'gemini', model: 'gemini-3.1-pro' }}
        connectedProviderIds={['anthropic', 'gemini']}
        disabled={false}
        onChange={onChange}
      />,
    );

    openPicker();
    expect(
      within(screen.getByRole('group', { name: 'Effort' }))
        .getByRole('button', { name: 'Low' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Version' })).getByRole('button', {
        name: '3.8',
      }),
    );

    const [preference] = onChange.mock.calls.at(-1) ?? [];
    expect(preference?.providerId).toBe('gemini');
    expect(preference?.model).toContain('flash');
    expect(preference?.effort).toBe('low');
  });
});
