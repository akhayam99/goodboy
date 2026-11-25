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

    const line = await screen.findByText(/^Starts[ ]as[ ]Lead/, {}, WAIT);
    expect(line.textContent).toContain('A question or a check');
    screen.getByRole('button', { name: 'Attach files' });
    const kinds = screen.getByRole('tablist', { name: 'Plan' });
    expect(within(kinds).getAllByRole('tab')).toHaveLength(2);
  });

  it('opens the Edits menu with the four things an agent may do', async () => {
    mount({ id: 'u28-start-run-edits-menu' });

    const menu = await screen.findByRole('dialog', { name: 'Edits' }, WAIT);
    expect(
      within(menu)
        .getAllByRole('tab')
        .map((tab) => tab.textContent?.split('.')[0]),
    ).toEqual([
      expect.stringContaining('Read only'),
      expect.stringContaining('Ask first'),
      expect.stringContaining('Edits allowed'),
      expect.stringContaining('Full access'),
    ]);
  });

  it('names the model of the Lead on the Where it runs line, not in the route line', async () => {
    mount({ id: 'u28-start-run-route-line' });

    const line = await screen.findByText(/^Starts[ ]as[ ]Lead/, {}, WAIT);
    const chip = screen.getByRole('button', { name: /^Change the Lead model for this run/ });
    expect(chip.getAttribute('aria-label')).toMatch(/, Auto$/);
    expect(line.textContent).toMatch(/^Starts[ ]as[ ]Lead · A question or a check/);
    expect(screen.getByRole('group', { name: 'Where it runs' }).textContent).toMatch(/^Lead on /);
  });

  it('opens the Model menu with the picker and the link to the default', async () => {
    mount({ id: 'u28-start-run-model-menu' });

    const menu = await screen.findByRole('dialog', { name: 'Lead model' }, WAIT);
    within(menu).getByRole('button', { name: /^Auto, now / });
    within(menu).getByRole('button', { name: 'Change the default in Every run' });
  });

  it('starts a task with an end as a Lead, never the orchestrator', async () => {
    mount({ id: 'u28-start-run-orchestrated' });

    const line = await screen.findByText(/^Starts[ ]as[ ]Lead/, {}, WAIT);
    expect(line.textContent).toContain('A task with an end');
    expect(line.textContent).not.toContain('Orchestrated');
    expect(
      screen
        .getByRole('button', { name: /^Change the Lead model for this run/ })
        .getAttribute('data-run-model'),
    ).toBe('auto');
  });

  it('shows No limit on the Limit chip when none is set', async () => {
    mount({ id: 'u28-start-run-no-limit' });

    await screen.findByRole('button', { name: 'Limit: none' }, WAIT);
  });
});
