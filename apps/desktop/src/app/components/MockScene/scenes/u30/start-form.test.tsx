// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U30_START_FORM_SCENES } from './start-form';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: keyof typeof U30_START_FORM_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U30_START_FORM_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const settingsRow = async () =>
  within(await screen.findByRole('group', { name: 'Run settings' }, WAIT));

describe('the u30 start form scenes', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U30_START_FORM_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws the preset kind with its steps and one settings row', async () => {
    mount({ id: 'u30-start-form' });

    const row = await settingsRow();
    row.getByRole('combobox', { name: 'Where' });
    row.getByRole('button', { name: /^Asks you:/ });
    row.getByRole('button', { name: /^Edits:/ });
    row.getByRole('button', { name: /^Limit \$5\.00/ });
    within(screen.getByRole('list', { name: 'Preset steps' })).getAllByRole('listitem');
    screen.getByRole('button', { name: 'Start workflow' });
  });

  it('draws the agent kind with a role and no limit or Asks you', async () => {
    mount({ id: 'u30-start-form-agent' });

    const row = await settingsRow();
    expect(row.getByRole('combobox', { name: 'Role' }).textContent).toContain('Scout');
    expect(row.queryByRole('button', { name: /^Limit / })).toBeNull();
    expect(row.queryByRole('button', { name: /^Asks you:/ })).toBeNull();
    screen.getByRole('button', { name: 'Start Scout' });
  });

  it('draws the Auto and Orchestrated kinds', async () => {
    mount({ id: 'u30-start-form-auto' });
    screen.getByRole('button', { name: 'Start Auto agent' });
    (await settingsRow()).getByRole('button', { name: /^Asks you:/ });
    cleanup();

    mount({ id: 'u30-start-form-orchestrated' });
    expect(await screen.findByRole('button', { name: 'Start workflow' }, WAIT)).toBeDefined();
  });

  it('draws the unpicked state that lets Auto pick', async () => {
    mount({ id: 'u30-start-form-auto-picks' });

    await settingsRow();
    screen.getByText(/^Starts[ ]as/);
  });

  it('opens the Edits and the Limit popovers inside the window', async () => {
    mount({ id: 'u30-start-form-edits-open' });
    const edits = await screen.findByRole('dialog', { name: 'Edits' }, WAIT);
    expect(within(edits).getAllByRole('tab')).toHaveLength(4);
    cleanup();

    mount({ id: 'u30-start-form-limit-open' });
    await screen.findByRole('dialog', { name: /^Limit for/ }, WAIT);
  });
});
