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
import { toolCheckKey } from './toolCheckKey';

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
  it('writes each tool of the named workspace, with the key state and the time', async () => {
    stubStoryInvoke({
      integration_credential_has_secret: (payload: SecretPayload) =>
        payload.credentialId === LINEAR_KEY,
    });

    await useAppStore.getState().checkTools({ workspaceId: HARBORLINE });

    const checks = useAppStore.getState().toolLastCheck;
    expect(checks[toolCheckKey({ workspaceId: HARBORLINE, tool: 'linear' })]).toMatchObject({
      result: 'ok',
      isChecking: false,
    });
    expect(checks[toolCheckKey({ workspaceId: HARBORLINE, tool: 'sentry' })]).toMatchObject({
      result: 'key-missing',
    });
    expect(checks[toolCheckKey({ workspaceId: HARBORLINE, tool: 'github' })]).toMatchObject({
      result: 'ok',
    });
    expect(checks[toolCheckKey({ workspaceId: NORTHWIND, tool: 'linear' })]).toBeUndefined();
  });

  it('records a failed check with its time and keeps nothing faked', async () => {
    stubStoryInvoke({
      integration_credential_has_secret: () => Promise.reject(new Error('keychain locked')),
    });

    await useAppStore.getState().checkTools({ workspaceId: NORTHWIND });

    const check =
      useAppStore.getState().toolLastCheck[
        toolCheckKey({ workspaceId: NORTHWIND, tool: 'linear' })
      ];
    expect(check?.result).toBe('failed');
    expect(check?.checkedAtMs).not.toBeNull();
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

    expect(
      useAppStore.getState().toolLastCheck[toolCheckKey({ workspaceId: NORTHWIND, tool: 'linear' })]
        ?.result,
    ).toBe('ok');
  });
});
