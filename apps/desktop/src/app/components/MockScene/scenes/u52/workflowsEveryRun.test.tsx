// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { U52_WORKFLOWS_EVERY_RUN_SCENES } from './workflowsEveryRun';

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: () => [] });
});
afterEach(cleanup);

type SceneParams = {
  readonly name: string;
};

const renderScene = ({ name }: SceneParams) => {
  const Scene = U52_WORKFLOWS_EVERY_RUN_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u52 Every run scenes', () => {
  it('opens Workflows on Every run with the Lead and the roles and no older plan runs', async () => {
    renderScene({ name: 'u52-workflows-every-run-light' });

    await screen.findByRole('region', { name: 'Roles' });
    expect(screen.getByRole('tab', { name: 'Every run' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    screen.getByRole('region', { name: 'Runs' });
    expect(screen.queryByRole('region', { name: 'Older plan runs' })).toBeNull();
  });

  it('adds Older plan runs while a plan run is open', async () => {
    renderScene({ name: 'u52-workflows-every-run-plan-dark' });

    await screen.findByRole('region', { name: 'Older plan runs' });
    screen.getByText('Models in older plan runs');
  });

  it('lists every scene in light and dark', () => {
    expect(Object.keys(U52_WORKFLOWS_EVERY_RUN_SCENES)).toEqual([
      'u52-workflows-every-run-light',
      'u52-workflows-every-run-dark',
      'u52-workflows-every-run-plan-light',
      'u52-workflows-every-run-plan-dark',
    ]);
  });
});
