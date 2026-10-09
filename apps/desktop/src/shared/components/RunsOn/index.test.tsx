// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { AgentKindRouting } from '../../../features/session/agent-kind';
import { useAppStore } from '../../../store';
import type { AppStore } from '../../../store/store';
import { RunsOn } from './index';

const SUGGESTED: AgentKindRouting = {
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
};

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

beforeEach(() => {
  useAppStore.setState({
    providers: [connected('anthropic'), connected('codex'), connected('cursor')],
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ providers: [] });
});

type HostProps = {
  readonly onValue: (value: AgentKindRouting | null) => void;
};

const Host = ({ onValue }: HostProps) => {
  const [override, setOverride] = useState<AgentKindRouting | null>(null);
  onValue(override);
  return <RunsOn suggested={SUGGESTED} override={override} onChange={setOverride} />;
};

const dialog = () => within(screen.getByRole('dialog', { name: /^Runs on/ }));

describe('RunsOn', () => {
  it('keeps Cursor, Opus 5.5 and Medium, then goes back to the suggestion', () => {
    let override: AgentKindRouting | null = null;
    render(<Host onValue={(next) => (override = next)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    fireEvent.click(dialog().getByRole('button', { name: 'Cursor' }));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Model' })).getByText('Opus'));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Version' })).getByText('5.5'));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Effort' })).getByText('Medium'));

    expect(override).toEqual({
      provider: 'cursor',
      model: 'claude-opus-5-5-medium',
      effort: 'medium',
    });

    fireEvent.click(dialog().getByRole('button', { name: /^Suggested/ }));

    expect(override).toBeNull();
  });
});
