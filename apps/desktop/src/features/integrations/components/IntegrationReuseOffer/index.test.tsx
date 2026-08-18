import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Workspace,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';

const APP_WEB = 'workspace-app-web' as WorkspaceId;
const API = 'workspace-api' as WorkspaceId;

type Store = {
  workspaces: ReadonlyArray<Workspace>;
  workspaceIntegrations: Record<string, ReadonlyArray<WorkspaceIntegration>>;
  declinedIntegrationReuse: Record<string, ReadonlyArray<WorkspaceIntegrationProvider>>;
  reuseIntegration: ReturnType<typeof vi.fn>;
  declineIntegrationReuse: ReturnType<typeof vi.fn>;
};

const linear: WorkspaceIntegration = {
  id: 'integration-1' as WorkspaceIntegrationId,
  workspaceId: APP_WEB,
  provider: 'linear',
  config: { workspaceUrlKey: 'serenis', viewerUserId: 'user-1', viewerName: 'Amin Khayam' },
  credentialKey: `goodboy.workspace.${APP_WEB}.linear`,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-02-01T00:00:00.000Z' as IsoDateTime,
};

const store: Store = {
  workspaces: [],
  workspaceIntegrations: {},
  declinedIntegrationReuse: {},
  reuseIntegration: vi.fn(async () => undefined),
  declineIntegrationReuse: vi.fn(),
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

import { IntegrationReuseOffer } from './index';

beforeEach(() => {
  store.workspaces = [
    {
      id: APP_WEB,
      name: 'app-web',
      rootPath: '/repos/app-web',
      createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    },
  ];
  store.workspaceIntegrations = { [APP_WEB]: [linear] };
  store.declinedIntegrationReuse = {};
  store.reuseIntegration = vi.fn(async () => undefined);
  store.declineIntegrationReuse = vi.fn();
});

afterEach(cleanup);

describe('IntegrationReuseOffer', () => {
  it('asks whether to reuse the configuration another workspace already holds', () => {
    render(<IntegrationReuseOffer provider="linear" workspaceId={API} />);

    expect(screen.getByText(/reuse the linear personal api key you already saved/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /reuse it here/i })).toBeDefined();
  });

  it('names the account and the workspace the configuration comes from', () => {
    render(<IntegrationReuseOffer provider="linear" workspaceId={API} />);

    expect(screen.getByText(/Amin Khayam on linear\.app\/serenis/)).toBeDefined();
    expect(screen.getByText(/configured in app-web/)).toBeDefined();
  });

  it('offers nothing when no workspace has that provider configured', () => {
    store.workspaceIntegrations = {};

    render(<IntegrationReuseOffer provider="linear" workspaceId={API} />);

    expect(screen.queryByRole('button', { name: /reuse it here/i })).toBeNull();
  });

  it('offers nothing when this workspace is already configured', () => {
    store.workspaceIntegrations = {
      [APP_WEB]: [linear],
      [API]: [{ ...linear, workspaceId: API }],
    };

    render(<IntegrationReuseOffer provider="linear" workspaceId={API} />);

    expect(screen.queryByRole('button', { name: /reuse it here/i })).toBeNull();
  });

  it('applies nothing until the reuse is accepted', () => {
    render(<IntegrationReuseOffer provider="linear" workspaceId={API} />);

    expect(store.reuseIntegration).not.toHaveBeenCalled();
  });

  it('reuses into this workspace once accepted, and reports it connected', async () => {
    const onReused = vi.fn();
    render(<IntegrationReuseOffer provider="linear" workspaceId={API} onReused={onReused} />);

    fireEvent.click(screen.getByRole('button', { name: /reuse it here/i }));

    await waitFor(() =>
      expect(store.reuseIntegration).toHaveBeenCalledWith({
        provider: 'linear',
        workspaceId: API,
      }),
    );
    await waitFor(() => expect(onReused).toHaveBeenCalledTimes(1));
  });

  it('declining records the refusal and configures nothing', () => {
    const onReused = vi.fn();
    render(<IntegrationReuseOffer provider="linear" workspaceId={API} onReused={onReused} />);

    fireEvent.click(screen.getByRole('button', { name: /enter a different one/i }));

    expect(store.declineIntegrationReuse).toHaveBeenCalledWith({
      provider: 'linear',
      workspaceId: API,
    });
    expect(store.reuseIntegration).not.toHaveBeenCalled();
    expect(onReused).not.toHaveBeenCalled();
  });

  it('stays out of the way once the offer has been declined for this workspace', () => {
    store.declinedIntegrationReuse = { [API]: ['linear'] };

    render(<IntegrationReuseOffer provider="linear" workspaceId={API} />);

    expect(screen.queryByRole('button', { name: /reuse it here/i })).toBeNull();
  });

  it('shows the failure and leaves the workspace unconfigured when the copy is refused', async () => {
    store.reuseIntegration = vi.fn(async () => {
      throw new Error('keychain refused');
    });
    const onReused = vi.fn();
    render(<IntegrationReuseOffer provider="linear" workspaceId={API} onReused={onReused} />);

    fireEvent.click(screen.getByRole('button', { name: /reuse it here/i }));

    expect(await screen.findByText(/keychain refused/)).toBeDefined();
    expect(onReused).not.toHaveBeenCalled();
  });

  it('calls the Slack credential a bot token, because it is not personal', () => {
    const slack: WorkspaceIntegration = {
      id: 'integration-slack' as WorkspaceIntegrationId,
      workspaceId: APP_WEB,
      provider: 'slack',
      config: { teamId: 'T1', teamName: 'Serenis', botUserId: 'U1', botUserName: 'goodboy' },
      credentialKey: `goodboy.workspace.${APP_WEB}.slack`,
      createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-02-01T00:00:00.000Z' as IsoDateTime,
    };
    store.workspaceIntegrations = { [APP_WEB]: [slack] };

    render(<IntegrationReuseOffer provider="slack" workspaceId={API} />);

    expect(screen.getByText(/reuse the slack bot token you already saved/i)).toBeDefined();
  });
});
