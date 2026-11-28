// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { EVERY_RUN_PREFERRED_LANGUAGE_SCENES } from './preferredLanguage';

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
  const Scene = EVERY_RUN_PREFERRED_LANGUAGE_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`No scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the Preferred language scenes', () => {
  it('shows Auto under Agents when no language is set', async () => {
    renderScene({ name: 'every-run-preferred-language-auto-light' });

    const picker = await screen.findByRole('combobox', { name: 'Preferred language' });
    expect(picker.textContent).toContain('Auto');
  });

  it('shows the language the workspace picked, by its native name', async () => {
    renderScene({ name: 'every-run-preferred-language-italian-dark' });

    const picker = await screen.findByRole('combobox', { name: 'Preferred language' });
    expect(picker.textContent).toContain('Italiano');
  });

  it('lists every scene', () => {
    expect(Object.keys(EVERY_RUN_PREFERRED_LANGUAGE_SCENES)).toEqual([
      'every-run-preferred-language-auto-light',
      'every-run-preferred-language-italian-light',
      'every-run-preferred-language-italian-dark',
    ]);
  });
});
