// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ConnectionsStudio } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: [
      {
        id: 'anthropic',
        binary: 'claude',
        capabilities: { models: [] },
        connection: 'installed_disconnected',
        version: '2.1.296',
        identity: null,
        label: 'Claude',
        error: null,
        docsUrl: 'https://docs.harborline.test',
      },
    ],
  });
});

afterEach(cleanup);

describe('ConnectionsStudio', () => {
  it('lists the providers of this Mac and the integrations of the workspace under one title', async () => {
    render(<ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />);

    await screen.findByRole('heading', { name: 'Connections' });
    const providers = screen.getByRole('region', { name: 'Providers' });
    const tools = screen.getByRole('region', { name: 'Integrations' });
    within(providers).getByText('This Mac, every workspace');
    within(providers).getByRole('button', { name: /^Claude/ });
    within(providers).getByLabelText('Not signed in');
    within(tools).getByText('Harborline workspace');
    within(tools).getByRole('button', { name: 'GitHub' });
  });

  it('keeps only the providers when no workspace is open', async () => {
    render(<ConnectionsStudio currentWorkspace={null} onClose={() => undefined} />);

    await screen.findByRole('region', { name: 'Providers' });
    expect(screen.queryByRole('region', { name: 'Integrations' })).toBeNull();
  });

  it('opens the provider page inside Connections from its row', async () => {
    const onOpen = vi.fn();
    window.addEventListener('goodboy:open-settings', onOpen);
    render(<ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: /^Claude/ }));

    expect(onOpen).not.toHaveBeenCalled();
    expect(useAppStore.getState().appStudio).toEqual({
      kind: 'connections',
      focus: { provider: 'anthropic' },
    });
    window.removeEventListener('goodboy:open-settings', onOpen);
  });

  it('shows the provider page under a trail that leads back to Connections', async () => {
    const refreshProviders = vi.fn(async () => undefined);
    useAppStore.setState({ refreshProviders });
    useAppStore.getState().openStudio({
      studio: { kind: 'connections', focus: { provider: 'anthropic' } },
    });
    render(
      <ConnectionsStudio
        currentWorkspace={WORKSPACE}
        focus={{ provider: 'anthropic' }}
        onClose={() => undefined}
      />,
    );

    await screen.findByRole('heading', { level: 1, name: 'Claude' });
    expect(screen.queryByRole('region', { name: 'Providers' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connections' }));

    expect(refreshProviders).toHaveBeenCalledOnce();
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'connections', focus: null });
  });
});
