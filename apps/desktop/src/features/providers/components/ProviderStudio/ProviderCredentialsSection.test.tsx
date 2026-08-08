// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { ProviderCredentialsSection } from './ProviderCredentialsSection';

afterEach(cleanup);

describe('ProviderCredentialsSection', () => {
  it('reveals the remove control on keyboard focus, not only on hover', () => {
    render(<ProviderCredentialsSection providerId={'anthropic' as ProviderId} />);
    const remove = screen.getByRole('button', { name: 'Remove work' });

    expect(remove.className).toContain('opacity-0');
    expect(remove.className).toContain('focus-visible:opacity-100');
    expect(remove.className).toContain('group-hover:opacity-100');
  });
});
