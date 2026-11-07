// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U28_STEP_ENDED_SCENES } from './step-ended';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, attachment_read: '' });
});

afterEach(cleanup);

describe('u28 step ended scene', () => {
  it('reads the ended step as Not finished on the run page and keeps the reason for its own page', async () => {
    const Scene = U28_STEP_ENDED_SCENES['u28-step-ended-run'];
    if (Scene === undefined) {
      throw new Error('no scene');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await screen.findByText('Not finished', undefined, WAIT);
    screen.getByRole('button', { name: 'Restart step' });
    screen.getByRole('button', { name: 'Keep working' });
    expect(screen.queryByText('This step ended without a result')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark step done' })).toBeNull();
    expect(
      screen.queryByText('The step stopped without saying why. Tell it what to do next.'),
    ).toBeNull();
  });
});
