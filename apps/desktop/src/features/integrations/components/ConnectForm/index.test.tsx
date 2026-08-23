// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { IntegrationCredentialId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    integrationCredentials: [] as ReadonlyArray<unknown>,
    integrationCredentialUsage: {} as Record<string, number>,
    forgetIntegrationCredential: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

beforeEach(() => {
  state.integrationCredentials = [];
  state.integrationCredentialUsage = {};
  state.forgetIntegrationCredential = vi.fn(async () => undefined);
});
afterEach(cleanup);

import { ConnectForm, type ConnectSubmission } from '.';

const savedCredential = {
  id: 'cred-1' as IntegrationCredentialId,
  provider: 'linear',
  account: 'ada@acme.dev',
  label: 'Work key',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const baseProps = {
  tokenId: 'test-token',
  tokenLabel: 'Personal API key',
  tokenPlaceholder: 'tok_…',
} as const;

describe('ConnectForm', () => {
  it('shows only the token field, its link and Connect by default', () => {
    render(
      <ConnectForm
        {...baseProps}
        tokenLink={{ label: 'Get a token from Acme', href: 'https://acme.dev/tokens' }}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByLabelText('Personal API key')).toBeDefined();
    expect(screen.getByRole('link', { name: /get a token from Acme/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeDefined();
  });

  it('places the get-a-token link after the token field', () => {
    render(
      <ConnectForm
        {...baseProps}
        tokenLink={{ label: 'Get a token from Acme', href: 'https://acme.dev/tokens' }}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );
    const field = screen.getByLabelText('Personal API key');
    const link = screen.getByRole('link', { name: /get a token from Acme/i });
    expect(field.compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps Connect disabled until the token has content, then submits it trimmed', async () => {
    const onSubmit = vi.fn(async (_submission: ConnectSubmission) => undefined);
    render(<ConnectForm {...baseProps} onSubmit={onSubmit} />);
    const connect = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Personal API key'), {
      target: { value: '  tok_secret  ' },
    });
    expect(connect.disabled).toBe(false);
    fireEvent.click(connect);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ token: 'tok_secret', credentialId: null }),
    );
  });

  it('clears the token after a successful submit', async () => {
    render(<ConnectForm {...baseProps} onSubmit={vi.fn(async () => undefined)} />);
    const field = screen.getByLabelText('Personal API key') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'tok_secret' } });
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() => expect(field.value).toBe(''));
  });

  it('shows the submit failure inline and keeps the token for a retry', async () => {
    render(
      <ConnectForm
        {...baseProps}
        onSubmit={vi.fn(async () => {
          throw new Error('token rejected');
        })}
      />,
    );
    const field = screen.getByLabelText('Personal API key') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'tok_bad' } });
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('token rejected');
    expect(field.value).toBe('tok_bad');
  });

  describe('after-token config', () => {
    const AfterTokenHarness = ({
      onSubmit,
    }: {
      readonly onSubmit: (submission: ConnectSubmission) => Promise<void>;
    }) => {
      const [org, setOrg] = useState('');
      return (
        <ConnectForm
          {...baseProps}
          config={{
            presentation: 'after-token',
            fields: [
              {
                id: 'test-org',
                label: 'Organization',
                placeholder: 'my-org',
                value: org,
                onValueChange: setOrg,
              },
            ],
          }}
          isConfigComplete={org.trim() !== ''}
          onSubmit={onSubmit}
        />
      );
    };

    it('keeps the config fields out of sight until the token is pasted', () => {
      render(<AfterTokenHarness onSubmit={vi.fn(async () => undefined)} />);
      expect(screen.queryByLabelText('Organization')).toBeNull();
      fireEvent.change(screen.getByLabelText('Personal API key'), {
        target: { value: 'tok_secret' },
      });
      expect(screen.getByLabelText('Organization')).toBeDefined();
    });

    it('keeps Connect disabled until the revealed config is complete', () => {
      render(<AfterTokenHarness onSubmit={vi.fn(async () => undefined)} />);
      fireEvent.change(screen.getByLabelText('Personal API key'), {
        target: { value: 'tok_secret' },
      });
      const connect = screen.getByRole('button', { name: /^connect$/i }) as HTMLButtonElement;
      expect(connect.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'acme' } });
      expect(connect.disabled).toBe(false);
    });
  });

  it('keeps disclosure config collapsed until asked for', () => {
    render(
      <ConnectForm
        {...baseProps}
        config={{
          presentation: 'disclosure',
          disclosureLabel: 'Self-hosted?',
          fields: [
            {
              id: 'test-host',
              label: 'Host',
              placeholder: 'https://example.dev',
              value: '',
              onValueChange: vi.fn(),
            },
          ],
        }}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.queryByLabelText('Host')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /self-hosted\?/i }));
    expect(screen.getByLabelText('Host')).toBeDefined();
  });

  it('keeps the note collapsed until asked for', () => {
    render(
      <ConnectForm
        {...baseProps}
        note={{ label: 'Where your key goes', body: 'Straight into the keychain.' }}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.queryByText(/straight into the keychain/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /where your key goes/i }));
    expect(screen.getByText(/straight into the keychain/i)).toBeDefined();
  });

  describe('with a saved credential', () => {
    beforeEach(() => {
      state.integrationCredentials = [savedCredential];
    });

    it('hides the token field and the guide once a saved key is picked', () => {
      render(
        <ConnectForm
          {...baseProps}
          credentialProvider="linear"
          guide={<p>guided setup</p>}
          onSubmit={vi.fn(async () => undefined)}
        />,
      );
      expect(screen.getByText('guided setup')).toBeDefined();
      fireEvent.click(screen.getByText('Work key'));
      expect(screen.queryByLabelText('Personal API key')).toBeNull();
      expect(screen.queryByText('guided setup')).toBeNull();
    });

    it('submits the picked credential with an empty token', async () => {
      const onSubmit = vi.fn(async (_submission: ConnectSubmission) => undefined);
      render(<ConnectForm {...baseProps} credentialProvider="linear" onSubmit={onSubmit} />);
      fireEvent.click(screen.getByText('Work key'));
      fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({ token: '', credentialId: 'cred-1' }),
      );
    });
  });
});
