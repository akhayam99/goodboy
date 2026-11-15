// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../../store/storyHarness')).dbModuleMock({
    insertProviderCredential: async () => undefined,
  }),
);
vi.mock('../../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../../../store/storyHarness';
import { ApiKeyForm } from './index';

const VALID = { status: 'valid', message: null };
const REJECTED = { status: 'rejected', message: 'invalid x-api-key' };
const KEY = 'sk-ant-harborline-0001';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ refreshProviders: vi.fn(async () => undefined) });
});

afterEach(cleanup);

type RenderParams = {
  readonly onClose?: () => void;
};

const renderForm = ({ onClose = vi.fn() }: RenderParams) => {
  render(<ApiKeyForm providerId="anthropic" onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('ANTHROPIC_API_KEY'), { target: { value: KEY } });
  return { onClose };
};

describe('the inline api key form', () => {
  it('saves the key for the provider it names, then closes', async () => {
    stubStoryInvoke({ provider_api_key_validate: VALID, secret_set: null });
    const { onClose } = renderForm({});

    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(useAppStore.getState().providerCredentials).toEqual([
      expect.objectContaining({ providerId: 'anthropic', label: 'api key' }),
    ]);
  });

  it('closes on cancel and saves nothing', () => {
    const { onClose } = renderForm({});

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(useAppStore.getState().providerCredentials).toEqual([]);
  });

  it('keeps the form and the typed key with the error when the save fails, and saves on retry', async () => {
    stubStoryInvoke({ provider_api_key_validate: REJECTED });
    const { onClose } = renderForm({});

    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe("Couldn't save the key. Check it and save again.");
    expect(onClose).not.toHaveBeenCalled();
    expect(useAppStore.getState().providerCredentials).toEqual([]);
    expect(screen.getByLabelText<HTMLInputElement>('ANTHROPIC_API_KEY').value).toBe(KEY);

    stubStoryInvoke({ provider_api_key_validate: VALID, secret_set: null });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
