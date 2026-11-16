// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type IntegrationBinding,
  type IntegrationBindingId,
  type IntegrationCredentialId,
  type IsoDateTime,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'harborline' });
const CREDENTIAL_ID = brandId<IntegrationCredentialId>({ value: 'cred-gitlab' });
const CREATED_AT = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });
const GITLAB: IntegrationBinding = {
  id: brandId<IntegrationBindingId>({ value: 'binding-gitlab' }),
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: CREDENTIAL_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  provider: 'gitlab',
  config: { userName: 'Platform Lead', userId: '7', host: 'https://gitlab.northwind.dev' },
};

type Deferred<Value> = {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
};

const deferred = <Value>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const commandsCalled = (): ReadonlyArray<string> =>
  storySpies.tauriInvoke.mock.calls.map(([command]) => String(command));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaceIntegrations: { [WORKSPACE_ID]: [GITLAB] },
    integrationKeyChecks: { [CREDENTIAL_ID]: { isPresent: false, checkedAt: 1 } },
  });
});

describe('replaceIntegrationKey', () => {
  it('checks the key with the host, rewrites the secret of the binding and keeps the binding', async () => {
    stubStoryInvoke({
      gitlab_validate_connection: { id: 7, username: 'platform-lead', name: 'Platform Lead' },
      integration_binding_replace_secret: null,
    });

    await useAppStore.getState().replaceIntegrationKey({
      workspaceId: WORKSPACE_ID,
      provider: 'gitlab',
      secret: '  glpat-new  ',
    });

    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('gitlab_validate_connection', {
      credentialId: CREDENTIAL_ID,
      host: 'https://gitlab.northwind.dev',
      token: 'glpat-new',
    });
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('integration_binding_replace_secret', {
      workspaceId: WORKSPACE_ID,
      provider: 'gitlab',
      credentialId: CREDENTIAL_ID,
      secret: 'glpat-new',
    });
    expect(commandsCalled()).not.toContain('gitlab_connect');
    const state = useAppStore.getState();
    expect(state.workspaceIntegrations[WORKSPACE_ID]).toEqual([GITLAB]);
    expect(state.integrationKeyChecks[CREDENTIAL_ID]?.isPresent).toBe(true);
  });

  it('leaves the old state and says why when the host refuses the key', async () => {
    stubStoryInvoke({
      gitlab_validate_connection: () => {
        throw new Error('401 Unauthorized');
      },
      integration_binding_replace_secret: null,
    });

    await expect(
      useAppStore.getState().replaceIntegrationKey({
        workspaceId: WORKSPACE_ID,
        provider: 'gitlab',
        secret: 'glpat-wrong',
      }),
    ).rejects.toThrow("GitLab didn't accept this key. Check it and try again.");

    expect(commandsCalled()).not.toContain('integration_binding_replace_secret');
    expect(useAppStore.getState().integrationKeyChecks[CREDENTIAL_ID]?.isPresent).toBe(false);
    expect(useAppStore.getState().workspaceIntegrations[WORKSPACE_ID]).toEqual([GITLAB]);
  });

  it('leaves the old state when the keychain write fails, and a retry saves', async () => {
    let shouldFail = true;
    stubStoryInvoke({
      gitlab_validate_connection: { id: 7, username: 'platform-lead', name: 'Platform Lead' },
      integration_binding_replace_secret: () => {
        if (shouldFail) {
          throw new Error('keychain locked');
        }
        return null;
      },
    });
    const replace = () =>
      useAppStore.getState().replaceIntegrationKey({
        workspaceId: WORKSPACE_ID,
        provider: 'gitlab',
        secret: 'glpat-new',
      });

    await expect(replace()).rejects.toThrow("Couldn't save the key in your Mac's keychain.");
    expect(useAppStore.getState().integrationKeyChecks[CREDENTIAL_ID]?.isPresent).toBe(false);

    shouldFail = false;
    await replace();

    expect(useAppStore.getState().integrationKeyChecks[CREDENTIAL_ID]?.isPresent).toBe(true);
    expect(useAppStore.getState().workspaceIntegrations[WORKSPACE_ID]).toEqual([GITLAB]);
  });

  it('names the workspace it writes to, and refuses a workspace with no binding', async () => {
    stubStoryInvoke({});

    await expect(
      useAppStore.getState().replaceIntegrationKey({
        workspaceId: brandId<WorkspaceId>({ value: 'northwind' }),
        provider: 'gitlab',
        secret: 'glpat-new',
      }),
    ).rejects.toThrow('GitLab is not connected in this workspace.');
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
  });

  it('drops a key check that was asked before the replace and lands after it', async () => {
    const lateCheck = deferred<boolean>();
    stubStoryInvoke({
      integration_credential_has_secret: () => lateCheck.promise,
      gitlab_validate_connection: { id: 7, username: 'platform-lead', name: 'Platform Lead' },
      integration_binding_replace_secret: null,
    });

    const check = useAppStore.getState().checkIntegrationKey({ credentialId: CREDENTIAL_ID });
    await useAppStore.getState().replaceIntegrationKey({
      workspaceId: WORKSPACE_ID,
      provider: 'gitlab',
      secret: 'glpat-new',
    });
    lateCheck.resolve(false);
    await check;

    expect(useAppStore.getState().integrationKeyChecks[CREDENTIAL_ID]?.isPresent).toBe(true);
  });

  it('drops a key check asked while the host checks the new key, once the key is saved', async () => {
    const lateCheck = deferred<boolean>();
    const hostCheck = deferred<object>();
    stubStoryInvoke({
      integration_credential_has_secret: () => lateCheck.promise,
      gitlab_validate_connection: () => hostCheck.promise,
      integration_binding_replace_secret: null,
    });

    const replace = useAppStore.getState().replaceIntegrationKey({
      workspaceId: WORKSPACE_ID,
      provider: 'gitlab',
      secret: 'glpat-new',
    });
    const check = useAppStore.getState().checkIntegrationKey({ credentialId: CREDENTIAL_ID });
    hostCheck.resolve({ id: 7, username: 'platform-lead', name: 'Platform Lead' });
    await replace;
    lateCheck.resolve(false);
    await check;

    expect(useAppStore.getState().integrationKeyChecks[CREDENTIAL_ID]?.isPresent).toBe(true);
  });
});

describe('checkIntegrationKey', () => {
  it('stores whether the keychain holds the key, with the time of the check', async () => {
    stubStoryInvoke({ integration_credential_has_secret: true });

    await useAppStore.getState().checkIntegrationKey({ credentialId: CREDENTIAL_ID });

    const check = useAppStore.getState().integrationKeyChecks[CREDENTIAL_ID];
    expect(check?.isPresent).toBe(true);
    expect(check?.checkedAt).toBeGreaterThan(1);
  });
});
