// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CredentialId, ProviderId } from '@goodboy/types';

type Credential = { id: CredentialId; providerId: ProviderId; label: string; hint: string };

type MockState = {
  providerCredentials: ReadonlyArray<Credential>;
  createCredential: ReturnType<typeof vi.fn>;
  deleteCredential: ReturnType<typeof vi.fn>;
  refreshProviders: ReturnType<typeof vi.fn>;
};

const { state } = vi.hoisted<{ state: MockState }>(() => ({
  state: {
    providerCredentials: [
      {
        id: 'cred-1' as CredentialId,
        providerId: 'anthropic' as ProviderId,
        label: 'work',
        hint: '••••1234',
      },
    ],
    createCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    refreshProviders: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: MockState) => T) => selector(state),
}));

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { ProviderCredentialsSection } from './ProviderCredentialsSection';

const ANTHROPIC = 'anthropic' as ProviderId;

afterEach(cleanup);

describe('ProviderCredentialsSection', () => {
  it('shows the remove control at rest', () => {
    render(<ProviderCredentialsSection providerId={ANTHROPIC} />);
    const remove = screen.getByRole('button', { name: 'Remove work' });

    expect(remove.className).not.toContain('opacity-0');
  });

  it('asks in a popover beside the key and removes it on confirm', async () => {
    render(<ProviderCredentialsSection providerId={ANTHROPIC} />);
    const list = screen.getByRole('list');
    const rowsBefore = list.children.length;

    const trigger = screen.getByRole('button', { name: 'Remove work' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Remove "work"?' });
    expect(list.contains(dialog)).toBe(false);
    expect(list.children.length).toBe(rowsBefore);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove work' }));

    await waitFor(() => expect(state.deleteCredential).toHaveBeenCalledWith('cred-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the key when the popover is cancelled', async () => {
    state.deleteCredential.mockClear();
    render(<ProviderCredentialsSection providerId={ANTHROPIC} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove work' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(state.deleteCredential).not.toHaveBeenCalled();
  });
});
