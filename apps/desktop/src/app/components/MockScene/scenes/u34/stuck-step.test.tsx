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
import { U34_STUCK_STEP_SCENES } from './stuck-step';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    attachment_read: '',
    turn_quiet: [],
  });
});

afterEach(cleanup);

type RenderParams = {
  readonly id: string;
};

const renderScene = ({ id }: RenderParams): void => {
  const Scene = U34_STUCK_STEP_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('u34 stuck step scenes', () => {
  it('shows a not finished step with Keep working and no reason on the run page', async () => {
    renderScene({ id: 'u34-p25-not-finished' });

    const word = await screen.findByText('Not finished', undefined, WAIT);
    expect(word.closest('[data-testid="timeline-row-state"]')?.className).toContain('text-warning');
    screen.getByRole('button', { name: /Keep working on/ });
    expect(screen.queryByText(/without saying why/)).toBeNull();
  });

  it('shows Skip step on the blocked row and no answer field on the run page', async () => {
    renderScene({ id: 'u34-p25-blocked' });

    await screen.findByRole('button', { name: /Skip step after/ }, WAIT);
    expect(screen.queryByRole('button', { name: 'Keep working' })).toBeNull();
    expect(screen.queryByRole('form', { name: 'Answer the step' })).toBeNull();
    expect(screen.queryByText(/stopped after saying|stopped without saying/)).toBeNull();
  });

  it('ends a finished run as finished with a step not finished, with a link to the step', async () => {
    renderScene({ id: 'u34-p25-finished' });

    await screen.findByText('Finished, 1 step not finished', undefined, WAIT);
    screen.getByRole('button', { name: /Open step/ });
    expect(screen.queryByText(/without saying why/)).toBeNull();
  });
});
