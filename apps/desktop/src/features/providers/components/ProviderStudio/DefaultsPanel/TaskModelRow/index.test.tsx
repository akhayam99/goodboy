import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getModelProvider } from '@goodboy/core';
import type { ProviderId, TaskModelPreference } from '@goodboy/types';
import { TaskModelRow } from './index';

const CONNECTED = ['anthropic', 'cursor'] satisfies ReadonlyArray<ProviderId>;

type RenderParams = {
  readonly preference: TaskModelPreference | null;
  readonly onChange: (preference: TaskModelPreference | null) => void;
};

const renderRow = ({ preference, onChange }: RenderParams) =>
  render(
    <TaskModelRow
      task="summarizer"
      label="Step summaries"
      help="writes the step summary"
      preference={preference}
      defaultProviderId="anthropic"
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
});
