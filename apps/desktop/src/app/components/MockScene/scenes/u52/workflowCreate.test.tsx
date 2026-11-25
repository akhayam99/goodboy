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
import { U52_WORKFLOW_CREATE_SCENES } from './workflowCreate';

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
  const Scene = U52_WORKFLOW_CREATE_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u52 workflow creation scenes', () => {
  it('opens an empty form with Create off and the reason under it', async () => {
    renderScene({ name: 'u52-workflow-create-empty-dark' });

    await screen.findByRole('heading', { name: 'New workflow' });
    screen.getByText('Name it first');
    expect(screen.getByRole('button', { name: 'Create workflow' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('fills the form and turns Create on', async () => {
    renderScene({ name: 'u52-workflow-create-filled-light' });

    await screen.findByRole('heading', { name: 'New workflow' });
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', 'Fix a flaky test');
    expect(screen.getByRole('button', { name: 'Create workflow' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('says the steps are being drafted and keeps Create off', async () => {
    renderScene({ name: 'u52-workflow-create-drafting-dark' });

    await screen.findByText('Steps are being drafted');
    expect(screen.getByRole('button', { name: 'Create workflow' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('shows the error of a failed create and keeps the fields', async () => {
    renderScene({ name: 'u52-workflow-create-failed-light' });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The database is locked');
    expect(screen.getByLabelText('Workflow name')).toHaveProperty('value', 'Fix a flaky test');
    screen.getByRole('button', { name: 'Retry' });
  });

  it('lists every scene in light and dark', () => {
    expect(Object.keys(U52_WORKFLOW_CREATE_SCENES)).toEqual([
      'u52-workflow-create-empty-light',
      'u52-workflow-create-empty-dark',
      'u52-workflow-create-filled-light',
      'u52-workflow-create-filled-dark',
      'u52-workflow-create-drafting-light',
      'u52-workflow-create-drafting-dark',
      'u52-workflow-create-failed-light',
      'u52-workflow-create-failed-dark',
    ]);
  });
});
