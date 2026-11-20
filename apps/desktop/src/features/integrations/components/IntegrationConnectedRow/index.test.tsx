// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IntegrationCredentialId } from '@goodboy/types';
import { credentialIdOf } from '../../../../__tests__/helpers/brandedIds';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { IntegrationConnectedRow } from '.';
import type { ReportErrorParams } from '../../../../store/slices/notifications/reportError';

const CREDENTIAL_ID = credentialIdOf({ value: 'cred-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type KeyParams = {
  readonly isPresent: boolean;
};

const keyChecked = ({ isPresent }: KeyParams): void => {
  useAppStore.setState({
    integrationKeyChecks: { [CREDENTIAL_ID]: { isPresent, checkedAt: 0 } },
  });
};

const renderRow = ({
  onDisconnect = vi.fn(async () => undefined),
  badge,
  credentialId,
}: {
  readonly onDisconnect?: () => Promise<void>;
  readonly badge?: string;
  readonly credentialId?: IntegrationCredentialId;
} = {}) =>
  render(
    <IntegrationConnectedRow
      provider="linear"
      primary="Connected as Ada Lovelace"
      secondary="linear.app/acme"
      {...(badge != null ? { badge } : {})}
      {...(credentialId != null ? { credentialId } : {})}
      disconnectDescription="Disconnects this project."
      onDisconnect={onDisconnect}
    />,
  );

describe('IntegrationConnectedRow', () => {
  it('shows the account and host on one row with a quiet disconnect', () => {
    renderRow();
    expect(screen.getByText('Connected as Ada Lovelace')).toBeDefined();
    expect(screen.getByText('linear.app/acme')).toBeDefined();
    expect(screen.getByRole('button', { name: /disconnect linear/i })).toBeDefined();
  });

  it('shows the scope badge only when one is handed in', () => {
    renderRow({ badge: 'Workspace key' });
    expect(screen.getByText('Workspace key')).toBeDefined();
    cleanup();
    renderRow();
    expect(screen.queryByText('Workspace key')).toBeNull();
  });

  it('arms the confirm instead of disconnecting immediately', () => {
    const onDisconnect = vi.fn(async () => undefined);
    renderRow({ onDisconnect });
    fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
    expect(screen.getByText(/disconnect linear\?/i)).toBeDefined();
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('disconnects once the confirm is confirmed', async () => {
    const onDisconnect = vi.fn(async () => undefined);
    renderRow({ onDisconnect });
    fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^disconnect linear$/i }),
    );
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
  });

  it('logs a rejected disconnect, keeps the row, and its Retry disconnects', async () => {
    const reportError = vi.fn(async (_params: ReportErrorParams) => undefined);
    useAppStore.setState({ reportError });
    const onDisconnect = vi.fn(async () => undefined);
    onDisconnect.mockRejectedValueOnce(new Error('keychain said no'));
    renderRow({ onDisconnect });
    fireEvent.click(screen.getByRole('button', { name: /disconnect linear/i }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^disconnect linear$/i }),
    );

    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    const reported = reportError.mock.calls[0]?.[0];
    expect(reported).toMatchObject({
      title: "Couldn't disconnect Linear",
      stays: 'Linear is still connected.',
    });
    expect(screen.queryByText(/keychain said no/i)).toBeNull();
    screen.getByText('Connected as Ada Lovelace');

    expect(await reported?.retry?.()).toBe(true);
    expect(onDisconnect).toHaveBeenCalledTimes(2);
  });
});

describe('a connection whose key left the keychain', () => {
  it('says the key is gone instead of claiming a healthy connection', () => {
    keyChecked({ isPresent: false });
    renderRow({ credentialId: CREDENTIAL_ID });

    expect(screen.getByText(/missing from this Mac/i)).toBeDefined();
    expect(screen.getByText('Connected as Ada Lovelace')).toBeDefined();
  });

  it('stays quiet while the key is where it should be', () => {
    keyChecked({ isPresent: true });
    renderRow({ credentialId: CREDENTIAL_ID });

    expect(screen.getByText('Connected as Ada Lovelace')).toBeDefined();
    expect(screen.queryByText(/missing from this Mac/i)).toBeNull();
  });

  it('stays quiet until the keychain has answered', () => {
    renderRow({ credentialId: CREDENTIAL_ID });

    expect(screen.queryByText('Key missing')).toBeNull();
  });
});

describe('a row whose disconnect lives in the page header', () => {
  const renderHeaderRow = ({ credentialId }: { readonly credentialId?: IntegrationCredentialId }) =>
    render(
      <IntegrationConnectedRow
        provider="linear"
        primary="Connected as Ada Lovelace"
        secondary="linear.app/acme"
        {...(credentialId != null ? { credentialId } : {})}
        disconnectDescription="Disconnects this project."
        hasHeaderDisconnect
        onDisconnect={vi.fn(async () => undefined)}
      />,
    );

  it('holds no button', () => {
    renderHeaderRow({});

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows one Key missing chip and no second sentence about it', () => {
    keyChecked({ isPresent: false });
    renderHeaderRow({ credentialId: CREDENTIAL_ID });

    screen.getByText('Key missing');
    expect(screen.queryByText(/missing from this Mac/i)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
