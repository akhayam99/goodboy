// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { resetStorySpies, stubStoryInvoke } from '../../storyHarness';
import { createCredential } from './createCredential';

type Call = { readonly command: string; readonly args: Record<string, unknown> };

const h = vi.hoisted(() => ({
  insertProviderCredentialSpy: vi.fn<() => Promise<void>>(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);

vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    insertProviderCredential: () => h.insertProviderCredentialSpy(),
  }),
);

vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const calls: Array<Call> = [];
let validation: { status: string; message: string | null } = { status: 'valid', message: null };
let shouldFailDelete = false;

const recordCall = ({ command, args }: Call) => {
  calls.push({ command, args });
};

const stubCredentialCommands = () => {
  stubStoryInvoke({
    provider_api_key_validate: (args: Record<string, unknown>) => {
      recordCall({ command: 'provider_api_key_validate', args });
      return validation;
    },
    secret_set: (args: Record<string, unknown>) => {
      recordCall({ command: 'secret_set', args });
      return null;
    },
    secret_delete: (args: Record<string, unknown>) => {
      recordCall({ command: 'secret_delete', args });
      if (shouldFailDelete) {
        throw new Error('keychain locked');
      }
      return null;
    },
  });
};

const providerId: ProviderId = 'anthropic';

const makeRun = () => {
  const set = vi.fn();
  return { set, run: createCredential(set) };
};

const commandsCalled = () => calls.map((call) => call.command);

describe('createCredential', () => {
  beforeEach(() => {
    resetStorySpies();
    stubCredentialCommands();
    calls.length = 0;
    shouldFailDelete = false;
    validation = { status: 'valid', message: null };
    h.insertProviderCredentialSpy.mockReset();
    h.insertProviderCredentialSpy.mockResolvedValue(undefined);
  });

  it('stores the secret and the row for a valid key', async () => {
    const harness = makeRun();

    const credential = await harness.run(providerId, 'Harborline', 'sk-ant-harborline-1234');

    expect(commandsCalled()).toEqual(['provider_api_key_validate', 'secret_set']);
    expect(h.insertProviderCredentialSpy).toHaveBeenCalledTimes(1);
    expect(harness.set).toHaveBeenCalledTimes(1);
    expect(credential.label).toBe('Harborline');
  });

  it('keeps going when the provider cannot check the key', async () => {
    validation = { status: 'unchecked', message: 'rate limited' };
    const harness = makeRun();

    await harness.run(providerId, 'Northwind', 'sk-ant-northwind-5678');

    expect(commandsCalled()).toContain('secret_set');
    expect(harness.set).toHaveBeenCalledTimes(1);
  });

  it('stores nothing when the provider rejects the key', async () => {
    validation = { status: 'rejected', message: 'API key rejected (unauthorized)' };
    const harness = makeRun();

    await expect(harness.run(providerId, 'Acme', 'sk-ant-acme-0000')).rejects.toThrow(/rejected/);

    expect(commandsCalled()).toEqual(['provider_api_key_validate']);
    expect(h.insertProviderCredentialSpy).not.toHaveBeenCalled();
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('deletes the secret again when the row cannot be written', async () => {
    h.insertProviderCredentialSpy.mockRejectedValue(new Error('disk full'));
    const harness = makeRun();

    await expect(harness.run(providerId, 'Cascadia', 'sk-ant-cascadia-9999')).rejects.toThrow(
      'disk full',
    );

    const stored = calls.find((call) => call.command === 'secret_set');
    const cleanup = calls.find((call) => call.command === 'secret_delete');
    expect(stored).toBeDefined();
    expect(cleanup?.args.key).toBe(stored?.args.key);
    expect(harness.set).not.toHaveBeenCalled();
  });

  it('says so when the leftover secret cannot be deleted either', async () => {
    h.insertProviderCredentialSpy.mockRejectedValue(new Error('disk full'));
    shouldFailDelete = true;
    const harness = makeRun();

    await expect(harness.run(providerId, 'Cascadia', 'sk-ant-cascadia-9999')).rejects.toThrow(
      /could not be removed again/,
    );

    expect(harness.set).not.toHaveBeenCalled();
  });
});
