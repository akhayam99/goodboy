// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { nextWorkspaceId } from '@goodboy/types/testing';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { WorkspaceBrowserDataRow } from './WorkspaceBrowserDataRow';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const NORTHWIND = nextWorkspaceId();
const LABEL = 'Clear browser data';

const clearCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_profile_clear');

const confirm = async () => {
  fireEvent.click(screen.getByRole('button', { name: LABEL }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Clear browser data for this workspace?',
  });
  expect(clearCalls()).toEqual([]);
  fireEvent.click(within(dialog).getByRole('button', { name: LABEL }));
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await openStorySqlite();
  await resetStoryStore();
});

afterEach(cleanup);

describe('WorkspaceBrowserDataRow', () => {
  it('asks first, clears the browser data of its workspace and says the tabs reloaded', async () => {
    stubStoryInvoke({ browser_profile_clear: { shouldRestart: false } });
    render(<WorkspaceBrowserDataRow workspaceId={NORTHWIND} />);

    await confirm();

    await waitFor(() =>
      expect(clearCalls()).toEqual([
        ['browser_profile_clear', { args: { workspaceId: NORTHWIND } }],
      ]),
    );
    expect((await screen.findByRole('status')).textContent).toBe('Cleared. Open tabs reloaded.');
  });

  it('says a restart finishes the clear where the platform needs one', async () => {
    stubStoryInvoke({ browser_profile_clear: { shouldRestart: true } });
    render(<WorkspaceBrowserDataRow workspaceId={NORTHWIND} />);

    await confirm();

    expect((await screen.findByRole('status')).textContent).toBe(
      'Cleared. Restart Goodboy to finish.',
    );
  });

  it('refuses while a clear is already running and lets the user try again', async () => {
    stubStoryInvoke({
      browser_profile_clear: () => {
        throw { kind: 'refused', message: 'profile-busy' };
      },
    });
    render(<WorkspaceBrowserDataRow workspaceId={NORTHWIND} />);

    await confirm();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Browser data is already clearing. Try again in a moment.',
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: LABEL })).toBeTruthy();
  });

  it('drops the answer of a clear that started for another workspace', async () => {
    let finish: (value: { readonly shouldRestart: boolean }) => void = () => undefined;
    stubStoryInvoke({
      browser_profile_clear: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const { rerender } = render(<WorkspaceBrowserDataRow workspaceId={NORTHWIND} />);
    await confirm();
    await waitFor(() => expect(clearCalls()).toHaveLength(1));

    rerender(<WorkspaceBrowserDataRow workspaceId={nextWorkspaceId()} />);
    finish({ shouldRestart: false });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('status')).toBeNull();
  });
});
