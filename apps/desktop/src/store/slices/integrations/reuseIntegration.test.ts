import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';

type CredentialReuseParams = {
  readonly provider: string;
  readonly fromWorkspaceId: WorkspaceId;
  readonly toWorkspaceId: WorkspaceId;
};

const { upsertWorkspaceIntegration, reuseIntegrationCredential, tauriDatabase } = vi.hoisted(
  () => ({
    upsertWorkspaceIntegration: vi.fn<
      (db: unknown, integration: WorkspaceIntegration) => Promise<void>
    >(async () => undefined),
    reuseIntegrationCredential: vi.fn<(params: CredentialReuseParams) => Promise<void>>(
      async () => undefined,
    ),
    tauriDatabase: {},
  }),
);

vi.mock('@goodboy/db', () => ({ upsertWorkspaceIntegration }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase }));
vi.mock('../../../features/integrations/credentialReuse', () => ({ reuseIntegrationCredential }));

import { reuseIntegration } from './reuseIntegration';

const APP_WEB = 'workspace-app-web' as WorkspaceId;
const API = 'workspace-api' as WorkspaceId;

const linear: WorkspaceIntegration = {
  id: 'integration-1' as WorkspaceIntegrationId,
  workspaceId: APP_WEB,
  provider: 'linear',
  config: { workspaceUrlKey: 'serenis', viewerUserId: 'user-1', viewerName: 'Amin Khayam' },
  credentialKey: `goodboy.workspace.${APP_WEB}.linear`,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-02-01T00:00:00.000Z' as IsoDateTime,
};

type State = {
  workspaceIntegrations: Record<string, ReadonlyArray<WorkspaceIntegration>>;
};

const harness = ({ configured }: { readonly configured: boolean }) => {
  const state: State = { workspaceIntegrations: configured ? { [APP_WEB]: [linear] } : {} };
  const set = (updater: (current: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  };
  const get = () => state;
  return { state, run: reuseIntegration(set as never, get as never) };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reuseIntegration', () => {
  it('copies the credential from the workspace that holds it to the one that does not', async () => {
    const { run } = harness({ configured: true });

    await run({ provider: 'linear', workspaceId: API });

    expect(reuseIntegrationCredential).toHaveBeenCalledWith({
      provider: 'linear',
      fromWorkspaceId: APP_WEB,
      toWorkspaceId: API,
    });
  });

  it('writes a row of its own for the new workspace, keyed to that workspace', async () => {
    const { run } = harness({ configured: true });

    await run({ provider: 'linear', workspaceId: API });

    expect(upsertWorkspaceIntegration).toHaveBeenCalledTimes(1);
    const written = upsertWorkspaceIntegration.mock.calls[0]?.[1];
    expect(written?.workspaceId).toBe(API);
    expect(written?.provider).toBe('linear');
    expect(written?.config).toEqual(linear.config);
    expect(written?.credentialKey).toBe(`goodboy.workspace.${API}.linear`);
    expect(written?.id).not.toBe(linear.id);
  });

  it('caches the reused configuration without disturbing the workspace it came from', async () => {
    const { state, run } = harness({ configured: true });

    await run({ provider: 'linear', workspaceId: API });

    expect(state.workspaceIntegrations[APP_WEB]).toEqual([linear]);
    expect(state.workspaceIntegrations[API]?.map((row) => row.provider)).toEqual(['linear']);
  });

  it('refuses when nothing is stored anywhere, so no empty row is written', async () => {
    const { run } = harness({ configured: false });

    await expect(run({ provider: 'linear', workspaceId: API })).rejects.toThrow(
      /no saved linear configuration/i,
    );
    expect(reuseIntegrationCredential).not.toHaveBeenCalled();
    expect(upsertWorkspaceIntegration).not.toHaveBeenCalled();
  });

  it('writes no row when the credential copy fails', async () => {
    reuseIntegrationCredential.mockRejectedValueOnce(new Error('keychain refused'));
    const { state, run } = harness({ configured: true });

    await expect(run({ provider: 'linear', workspaceId: API })).rejects.toThrow('keychain refused');
    expect(upsertWorkspaceIntegration).not.toHaveBeenCalled();
    expect(state.workspaceIntegrations[API]).toBeUndefined();
  });
});
