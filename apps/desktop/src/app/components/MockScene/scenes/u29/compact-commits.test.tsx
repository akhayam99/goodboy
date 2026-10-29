// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { U29_COMPACT_COMMITS_SCENES } from './compact-commits';

vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 12));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  installFakeResizeObserver();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    sceneInvoke({ command: String(command), args }),
  );
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('compact commits scene', () => {
  it('shows every author when the configured identity cannot be read', async () => {
    window.history.replaceState(null, '', '/?identity=unknown');
    const Scene = U29_COMPACT_COMMITS_SCENES['compact-commits'];
    render(
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>,
    );
    const list = await screen.findByRole('list', { name: 'Commits' });
    expect(within(list).getAllByLabelText('Harborline')).toHaveLength(4);
    expect(within(list).getAllByLabelText('Northwind')).toHaveLength(3);
  });

  it('keeps day headers outside the commit count and opens the existing reword editor', async () => {
    const Scene = U29_COMPACT_COMMITS_SCENES['compact-commits'];
    render(
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>,
    );
    const list = await screen.findByRole('list', { name: 'Commits' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);
    within(list).getByText('Today');
    within(list).getByText('Yesterday');
    expect(within(list).queryAllByLabelText('Harborline')).toHaveLength(0);
    expect(within(list).getAllByLabelText('Northwind')).toHaveLength(3);
    const first = within(list).getByRole('listitem', { name: 'Fix typo in CSV header' });
    fireEvent.click(within(first).getByRole('button', { name: 'More for f5c7d08' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Rename/ }));
    screen.getByRole('textbox', { name: 'Commit subject' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Commit subject' })).toBeNull();
  });
});
