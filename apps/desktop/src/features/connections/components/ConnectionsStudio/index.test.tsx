// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ConnectionsStudio } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const CLAUDE_FOCUS = { kind: 'provider', provider: 'anthropic' } as const;

const GITLAB_FOCUS = { kind: 'tool', tool: 'gitlab' } as const;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    refreshProviders: vi.fn(async () => undefined),
    loadCalendarSources: vi.fn(async () => undefined),
    providers: [
      {
        id: 'anthropic',
        binary: 'claude',
        capabilities: { models: [] },
        connection: 'installed_disconnected',
        version: '2.1.321',
        identity: null,
        label: 'Claude',
        error: null,
        docsUrl: 'https://docs.harborline.test',
      },
    ],
  });
});

afterEach(cleanup);

const viewportOf = (): HTMLElement => {
  const viewport = screen.getByRole('region', { name: 'Providers' }).parentElement;
  if (viewport === null) {
    throw new Error('no viewport');
  }
  return viewport;
};

describe('ConnectionsStudio', () => {
  it('shows the index when no provider is in focus', async () => {
    render(<ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />);

    await screen.findByRole('region', { name: 'Providers' });
    screen.getByRole('region', { name: 'Integrations' });
  });

  it('shows the provider page under a trail that leads back to the index', async () => {
    useAppStore.getState().openStudio({ studio: { kind: 'connections', focus: CLAUDE_FOCUS } });
    render(
      <ConnectionsStudio
        currentWorkspace={WORKSPACE}
        focus={CLAUDE_FOCUS}
        onClose={() => undefined}
      />,
    );

    await screen.findByRole('heading', { level: 1, name: 'Claude' });
    expect(screen.queryByRole('region', { name: 'Providers' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connections' }));

    expect(useAppStore.getState().refreshProviders).toHaveBeenCalledOnce();
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'connections', focus: null });
  });

  it('returns to the index at the scroll it had before the provider page opened', async () => {
    const { rerender } = render(
      <ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />,
    );
    await screen.findByRole('region', { name: 'Providers' });
    const before = viewportOf();
    before.scrollTop = 240;
    fireEvent.scroll(before);

    rerender(
      <ConnectionsStudio
        currentWorkspace={WORKSPACE}
        focus={CLAUDE_FOCUS}
        onClose={() => undefined}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'Claude' });
    rerender(<ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />);

    await screen.findByRole('region', { name: 'Providers' });
    expect(viewportOf().scrollTop).toBe(240);
  });

  it('shows the integration page under a trail that leads back to the index', async () => {
    useAppStore.getState().openStudio({ studio: { kind: 'connections', focus: GITLAB_FOCUS } });
    render(
      <ConnectionsStudio
        currentWorkspace={WORKSPACE}
        focus={GITLAB_FOCUS}
        onClose={() => undefined}
      />,
    );

    await screen.findByRole('heading', { level: 1, name: 'GitLab' });
    expect(screen.queryByRole('region', { name: 'Providers' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connections' }));

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'connections', focus: null });
  });

  it('returns to the index at the scroll it had before the integration page opened', async () => {
    const { rerender } = render(
      <ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />,
    );
    await screen.findByRole('region', { name: 'Providers' });
    const before = viewportOf();
    before.scrollTop = 180;
    fireEvent.scroll(before);

    rerender(
      <ConnectionsStudio
        currentWorkspace={WORKSPACE}
        focus={GITLAB_FOCUS}
        onClose={() => undefined}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'GitLab' });
    rerender(<ConnectionsStudio currentWorkspace={WORKSPACE} onClose={() => undefined} />);

    await screen.findByRole('region', { name: 'Providers' });
    expect(viewportOf().scrollTop).toBe(180);
  });
});
