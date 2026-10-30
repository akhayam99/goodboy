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
import { U30_START_GUIDANCE_SCENES } from './start-guidance';

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
  readonly id: keyof typeof U30_START_GUIDANCE_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U30_START_GUIDANCE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u30 start guidance scenes', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U30_START_GUIDANCE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('draws the Guidance chip with the workspace default and its tag', async () => {
    mount({ id: 'u30-start-guidance' });

    const row = within(await screen.findByRole('group', { name: 'Run settings' }, WAIT));
    const chip = row.getByRole('button', {
      name: /^Guidance: Keep every change inside payments-api/,
    });
    expect(chip.getAttribute('aria-label')).toMatch(/, from Harborline$/);
  });

  it('opens the popover for the Auto agent and its helpers', async () => {
    mount({ id: 'u30-start-guidance-open' });

    const popover = await screen.findByRole('dialog', { name: 'Guidance for this run' }, WAIT);
    within(popover).getByText('Read by the Auto agent and the helpers it starts.');
    expect(within(popover).getByRole<HTMLTextAreaElement>('textbox').value).toContain(
      'ledger-core schema',
    );
    within(popover).getByRole('button', { name: 'Use workspace guidance' });
    within(popover).getByRole('button', { name: 'No guidance' });
  });
});
