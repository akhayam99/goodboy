// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../providers/providers';

vi.mock('../../../providers/components/ProviderInlineConnect', () => ({
  ProviderInlineConnect: ({
    providerId,
    autoStart,
    onDone,
  }: {
    providerId: ProviderId;
    autoStart?: boolean;
    onDone: () => void;
  }) => (
    <section aria-label={`inline connect ${providerId}`}>
      <span>{autoStart === true ? 'auto start' : 'manual start'}</span>
      <button type="button" onClick={onDone}>
        Done
      </button>
    </section>
  ),
}));

import { ProviderRow } from './ProviderRow';

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

const provider = ({
  id,
  connection,
}: {
  readonly id: ProviderId;
  readonly connection: ProviderDisplayInfo['connection'];
}): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: CAPABILITIES,
  connection,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: 'https://example.com',
});

const Harness = ({ info }: { readonly info: ProviderDisplayInfo }) => {
  const [expanded, setExpanded] = useState<ProviderId | null>(null);
  return (
    <ul>
      <ProviderRow
        info={info}
        isExpanded={expanded === info.id}
        onExpandedChange={({ providerId }) => setExpanded(providerId)}
      />
    </ul>
  );
};

afterEach(cleanup);

describe('ProviderRow', () => {
  it('shows one connected status and no action once connected', () => {
    render(<Harness info={provider({ id: 'anthropic', connection: 'connected' })} />);
    expect(screen.getAllByText('Connected')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers Install when the CLI is missing', () => {
    render(<Harness info={provider({ id: 'codex', connection: 'missing' })} />);
    expect(screen.getByRole('button', { name: 'Install Codex' })).toBeDefined();
  });

  it('offers Connect when the CLI is installed but signed out', () => {
    render(<Harness info={provider({ id: 'cursor', connection: 'installed_disconnected' })} />);
    expect(screen.getByRole('button', { name: 'Connect Cursor' })).toBeDefined();
  });

  it('offers Add key on an API key provider', () => {
    render(<Harness info={provider({ id: 'openrouter', connection: 'missing' })} />);
    expect(screen.getByRole('button', { name: 'Add key OpenRouter' })).toBeDefined();
  });

  it('expands the connect flow inside the row, started, with no dialog', () => {
    render(<Harness info={provider({ id: 'codex', connection: 'missing' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Install Codex' }));

    expect(screen.getByRole('region', { name: 'inline connect codex' })).toBeDefined();
    expect(screen.getByText('auto start')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Install Codex' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'inline connect codex' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Install Codex' })).toBeDefined();
  });

  it('closes a CLI connect flow from the row header', () => {
    render(<Harness info={provider({ id: 'cursor', connection: 'installed_disconnected' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Cursor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'inline connect cursor' })).toBeNull();
  });
});
