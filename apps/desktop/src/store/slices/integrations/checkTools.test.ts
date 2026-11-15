// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });
const AT = brandId<IsoDateTime>({ value: '2026-11-15T10:00:00.000Z' });
const LINEAR_KEY = brandId<IntegrationCredentialId>({ value: 'cred-linear' });
const SENTRY_KEY = brandId<IntegrationCredentialId>({ value: 'cred-sentry' });

type BindingParams = {
  readonly workspaceId: WorkspaceId;
};

const linearBinding = ({ workspaceId }: BindingParams): IntegrationBinding => ({
  id: brandId<IntegrationBindingId>({ value: `linear-${workspaceId}` }),
  workspaceId,
  projectId: null,
  provider: 'linear',
  config: { workspaceUrlKey: 'harborline', viewerUserId: 'u-1', viewerName: 'Mara Quint' },
  credentialId: LINEAR_KEY,
  createdAt: AT,
  updatedAt: AT,
});

const sentryBinding = ({ workspaceId }: BindingParams): IntegrationBinding => ({
  id: brandId<IntegrationBindingId>({ value: `sentry-${workspaceId}` }),
  workspaceId,
  projectId: null,
  provider: 'sentry',
  config: { org: 'harborline', project: 'payments-api' },
  credentialId: SENTRY_KEY,
  createdAt: AT,
  updatedAt: AT,
});

type SecretPayload = {
  readonly credentialId?: string;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaceIntegrations: {
      [HARBORLINE]: [
        linearBinding({ workspaceId: HARBORLINE }),
        sentryBinding({ workspaceId: HARBORLINE }),
      ],
      [NORTHWIND]: [linearBinding({ workspaceId: NORTHWIND })],
    },
  });
});

describe('checkTools', () => {
  it('writes the key state and the time of each key the named workspace uses', async () => {
    const calls = vi.fn((payload: SecretPayload) => payload.credentialId === LINEAR_KEY);
    stubStoryInvoke({ integration_credential_has_secret: calls });

    await useAppStore.getState().checkTools({ workspaceId: HARBORLINE });

    const checks = useAppStore.getState().integrationKeyChecks;
    expect(checks[LINEAR_KEY]).toMatchObject({ isPresent: true });
    expect(checks[SENTRY_KEY]).toMatchObject({ isPresent: false });
    expect(checks[SENTRY_KEY]?.checkedAt).toBeGreaterThan(0);
    expect(calls.mock.calls.map(([payload]) => payload.credentialId)).toEqual([
      LINEAR_KEY,
      SENTRY_KEY,
    ]);
  });

  it('keeps the last key state and rejects when the keychain read fails', async () => {
    useAppStore.setState({
      integrationKeyChecks: { [LINEAR_KEY]: { isPresent: true, checkedAt: 1 } },
    });
    stubStoryInvoke({
      integration_credential_has_secret: () => Promise.reject(new Error('keychain locked')),
    });

    await expect(
      useAppStore.getState().checkTools({ workspaceId: NORTHWIND, isForced: true }),
    ).rejects.toThrow('keychain locked');

    expect(useAppStore.getState().integrationKeyChecks[LINEAR_KEY]).toEqual({
      isPresent: true,
      checkedAt: 1,
    });
  });

  it('skips a tool checked less than a minute ago, unless forced', async () => {
    const calls = vi.fn(() => true);
    stubStoryInvoke({ integration_credential_has_secret: calls });

    await useAppStore.getState().checkTools({ workspaceId: NORTHWIND });
    await useAppStore.getState().checkTools({ workspaceId: NORTHWIND });
    expect(calls).toHaveBeenCalledTimes(1);

    await useAppStore.getState().checkTools({ workspaceId: NORTHWIND, isForced: true });
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('drops a late answer for an older check of the same tool', async () => {
    const answers: Array<(value: boolean) => void> = [];
    stubStoryInvoke({
      integration_credential_has_secret: () =>
        new Promise<boolean>((resolve) => {
          answers.push(resolve);
        }),
    });

    const first = useAppStore.getState().checkTools({ workspaceId: NORTHWIND });
    const second = useAppStore.getState().checkTools({ workspaceId: NORTHWIND, isForced: true });
    answers[1]?.(true);
    await second;
    answers[0]?.(false);
    await first;

    expect(useAppStore.getState().integrationKeyChecks[LINEAR_KEY]?.isPresent).toBe(true);
  });
});
