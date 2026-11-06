// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U34_COMMENTS_COUNTS_SCENES } from './comments-counts';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = { readonly name: keyof typeof U34_COMMENTS_COUNTS_SCENES };
const mount = ({ name }: MountParams) => {
  const Scene = U34_COMMENTS_COUNTS_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the comments and counts scenes', () => {
  it('registers every scene once', () => {
    for (const name of Object.keys(U34_COMMENTS_COUNTS_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('draws one header primary and the three groups with Question and Fix to review', async () => {
    mount({ name: 'u34-u39-header' });

    const list = await screen.findByRole('navigation', { name: 'Comments' });
    const titles = within(list)
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'));
    expect(titles).toEqual(['Needs you', 'Working', 'Done', 'Left open on GitHub']);
    await waitFor(() => expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(1));
  });

  it('points the header Answer at the question waiting in Needs you', async () => {
    mount({ name: 'u34-u39-header' });

    const list = await screen.findByRole('navigation', { name: 'Comments' });
    await waitFor(() =>
      expect(document.querySelector('[data-branch-primary]')?.textContent).toBe('Answer'),
    );
    const group = within(list).getByRole('region', { name: 'Needs you' });
    expect(within(group).getAllByText('Question').length).toBeGreaterThan(0);
  });

  it('keeps a fix on the branch under Done as Fixed', async () => {
    mount({ name: 'u34-u44-groups' });

    const done = await screen.findByRole('region', { name: 'Done' });
    expect(within(done).getAllByText('Fixed').length).toBeGreaterThan(0);
  });

  it('shows the commit and file counts once on the pull request page', async () => {
    mount({ name: 'u34-u43-summary' });

    const strip = await screen.findByRole('tablist', { name: 'Branch pages' });
    expect(within(strip).getByRole('tab', { name: /^Commits/ }).textContent).toMatch(/^Commits/);
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull();
  });

  it('reads Draft on the chip of a comment not posted yet', async () => {
    mount({ name: 'u34-u34-draft' });

    await waitFor(() => expect(screen.getAllByText('Draft').length).toBeGreaterThan(0));
    expect(screen.queryByText('Note')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Branch pages' })).toBeNull();
  });

  it('counts the viewed files once in the file list title', async () => {
    mount({ name: 'u34-u38-viewed' });

    await waitFor(() => expect(screen.getAllByText(/^Viewed \d+ of \d+$/)).toHaveLength(1));
  });
});
