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
import { U28_START_RUN_SCENES } from './start-run';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(cleanup);

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U28_START_RUN_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u28 start run scenes', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U28_START_RUN_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('shows what Start will do under the box and the attach control', async () => {
    mount({ id: 'u28-start-run-route-line' });

    const line = await screen.findByText(/^Starts[ ]as.*Auto agent/, {}, WAIT);
    expect(line.textContent).toContain('A question or a check, and no preset fits');
    screen.getByRole('button', { name: 'Attach files' });
    screen.getByRole('button', { name: 'Run as: Let Auto pick' });
  });

  it('opens the Run as menu with every kind of run', async () => {
    mount({ id: 'u28-start-run-run-as-menu' });

    await screen.findByRole('button', { name: 'Workflow · Orchestrated' }, WAIT);
    screen.getByRole('button', { name: 'Workflow · Preset Fix a layout' });
    screen.getByRole('button', { name: 'Agent · Scout' });
  });

  it('names the model of the Auto agent next to Run as, and in the route line', async () => {
    mount({ id: 'u28-start-run-route-line' });

    const line = await screen.findByText(/^Starts[ ]as.*Auto agent/, {}, WAIT);
    const chip = screen.getByRole('button', { name: /^Model:/ });
    expect(chip.getAttribute('aria-label')).toMatch(/, Auto$/);
    expect(line.textContent).toMatch(/^Starts as Agent · Auto agent · .+ · A question or a check/);
  });

  it('opens the Model menu with the picker and the link to the default', async () => {
    mount({ id: 'u28-start-run-model-menu' });

    const menu = await screen.findByRole('dialog', { name: 'Auto agent model' }, WAIT);
    within(menu).getByRole('button', { name: /^Auto, now / });
    within(menu).getByRole('button', { name: 'Change the default in Settings' });
  });

  it('names the orchestrator when the ask becomes an orchestrated run', async () => {
    mount({ id: 'u28-start-run-orchestrated' });

    const line = await screen.findByText(/^Starts[ ]as.*Orchestrated/, {}, WAIT);
    expect(line.textContent).toContain('A task with an end');
    expect(screen.getByRole('button', { name: /^Model:/ }).getAttribute('data-run-model')).toBe(
      'auto',
    );
  });

  it('shows No limit on the Limit chip when none is set', async () => {
    mount({ id: 'u28-start-run-no-limit' });

    await screen.findByRole('button', { name: 'No limit' }, WAIT);
  });
});
