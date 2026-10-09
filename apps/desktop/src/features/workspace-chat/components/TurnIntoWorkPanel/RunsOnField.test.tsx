// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { WorkRouting } from '../../startWorkFromChat';
import { RunsOnField } from './RunsOnField';

const CONNECTED: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'cursor'];
const DEFAULT_ROUTING: WorkRouting = { provider: 'anthropic', model: 'sonnet-5', effort: 'high' };

afterEach(cleanup);

const dialog = () => within(screen.getByRole('dialog', { name: 'Runs on' }));

const openTrigger = () => fireEvent.click(screen.getByRole('button', { name: /^Runs on:/ }));

type HostProps = {
  readonly onValue: (value: WorkRouting | null) => void;
};

const Host = ({ onValue }: HostProps) => {
  const [value, setValue] = useState<WorkRouting | null>(null);
  onValue(value);
  return (
    <RunsOnField
      connectedProviders={CONNECTED}
      defaultRouting={DEFAULT_ROUTING}
      value={value}
      onChange={setValue}
    />
  );
};

describe('RunsOnField', () => {
  it('keeps Cursor, Opus 5.5 and Medium for the new session', () => {
    let value: WorkRouting | null = null;
    render(<Host onValue={(next) => (value = next)} />);
    openTrigger();

    fireEvent.click(dialog().getByRole('button', { name: 'Cursor' }));
    expect(value).toMatchObject({ provider: 'cursor' });
    fireEvent.click(within(dialog().getByRole('group', { name: 'Model' })).getByText('Opus'));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Version' })).getByText('5.5'));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Effort' })).getByText('Medium'));

    expect(value).toEqual({
      provider: 'cursor',
      model: 'claude-opus-5-5-medium',
      effort: 'medium',
    });
  });

  it('goes back to the default with the reset', () => {
    const onChange = vi.fn<(next: WorkRouting | null) => void>();
    render(
      <RunsOnField
        connectedProviders={CONNECTED}
        defaultRouting={DEFAULT_ROUTING}
        value={{ provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use default' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
