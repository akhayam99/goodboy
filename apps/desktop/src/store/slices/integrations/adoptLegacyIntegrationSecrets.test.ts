import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { adoptLegacyIntegrationSecrets } from './adoptLegacyIntegrationSecrets';

beforeEach(() => {
  invokeMock.mockReset();
});

describe('adoptLegacyIntegrationSecrets', () => {
  it('reports success once the keys moved', async () => {
    invokeMock.mockResolvedValueOnce(2);

    await expect(adoptLegacyIntegrationSecrets()).resolves.toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledWith('integration_credentials_adopt');
  });

  it('hands the failure back instead of swallowing it', async () => {
    const failure = new Error('keychain is locked');
    invokeMock.mockRejectedValueOnce(failure);

    await expect(adoptLegacyIntegrationSecrets()).resolves.toEqual({ ok: false, error: failure });
  });
});
