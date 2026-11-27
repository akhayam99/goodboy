// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { HomePage } from './index';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  store.setState({ currentWorkspaceId: WS, boardReady: true, switchingToWorkspaceId: null });
});

afterEach(cleanup);

const mount = () =>
  render(
    <ToastProvider>
      <HomePage workspaceId={WS} />
    </ToastProvider>,
  );

describe('HomePage', () => {
  it('names the page Home', () => {
    mount();

    screen.getByRole('heading', { name: 'Home' });
  });

  it('shows the start card and the cards that teach what will fill them on an empty workspace', () => {
    mount();

    screen.getByRole('region', { name: 'Start your first session' });
    expect(document.querySelector('[data-home-widget="needsYou"]')).toBeNull();
    expect(document.querySelector('[data-home-widget="runningNow"]')).toBeNull();
    expect(document.querySelector('[data-home-widget="sessionsToFinish"]')).toBeNull();
    within(
      document.querySelector<HTMLElement>('[data-home-widget="providerLimits"]') ?? document.body,
    ).getByText('Connect a provider to see what is left');
    within(
      document.querySelector<HTMLElement>('[data-home-widget="spend"]') ?? document.body,
    ).getByText('No spend yet. It fills as agents run.');
    within(
      document.querySelector<HTMLElement>('[data-home-widget="tasksInbox"]') ?? document.body,
    ).getByText('Connect a tracker to see its new issues.');
  });

  it('draws a skeleton for every widget while the workspace loads, and no zero', () => {
    store.setState({ boardReady: false });
    mount();

    expect(document.querySelectorAll('[data-home-widget]')).toHaveLength(6);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Start your first session' })).toBeNull();
  });
});
