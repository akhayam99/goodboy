// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_CENTRAL_DONE_SCENES } from './central-done';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };
const show = async ({ name }: Params) => {
  const Scene = U26_CENTRAL_DONE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown central done scene');
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const titlesOf = (): ReadonlyArray<string> =>
  [...screen.getByRole('region', { name: 'What was done' }).querySelectorAll('li .text-row')].map(
    (title) => title.textContent ?? '',
  );

describe('central done scenes', () => {
  it('lists the outcomes of today and then of Oct 16', async () => {
    await show({ name: 'u26-central-done-mid-light' });

    expect(titlesOf()).toEqual([
      'Scoped the change and wrote the tests first',
      'Summarised the plan',
      'Rebased on main',
      'Planned the change',
    ]);
  });

  it('opens one row with its facts and its steps', async () => {
    await show({ name: 'u26-central-done-open-dark' });
    const region = screen.getByRole('region', { name: 'What was done' });

    within(region).getByRole('button', { name: 'Show in log' });
    expect(within(region).getByRole('list', { name: 'Steps' })).toBeDefined();
    expect(within(region).getByText('Cost')).toBeDefined();
  });

  it('folds a Rebase all of nine branches into one opened row', async () => {
    await show({ name: 'u26-central-done-batch-light' });
    const region = screen.getByRole('region', { name: 'What was done' });

    expect(titlesOf()).toContain('Rebased 9 branches on main');
    expect(titlesOf()).not.toContain('Rebased on main');
    expect(within(region).getByText('Rebase all · 9 pushed, 3 PRs updated')).toBeDefined();
    expect(
      within(region).getByRole('list', { name: 'Branches' }).querySelectorAll('li'),
    ).toHaveLength(9);
    within(region).getByRole('button', { name: 'Show in log' });
  });

  it('titles a recap row with its first done line and a chained row with its first step', async () => {
    await show({ name: 'u26-central-done-recap-light' });
    const region = screen.getByRole('region', { name: 'What was done' });

    expect(titlesOf()).toContain('Batched the row reads in payments-api');
    expect(titlesOf()).toContain('apply fix');
    expect(region.textContent).not.toContain('{"done"');
    expect(region.querySelector('[data-done-full-text]')?.textContent).toBe(
      'apply fix -> verify tsc -> lint -> ready for push',
    );
  });

  it('opens the log drawer on the search moment', async () => {
    await show({ name: 'u26-central-log-search-light' });

    expect(screen.getByRole('region', { name: 'Log' })).toBeDefined();
    expect(screen.getByRole('searchbox', { name: 'Search the log' })).toBeDefined();
  });

  it('registers every scene key', () => {
    expect(Object.keys(U26_CENTRAL_DONE_SCENES)).toEqual([
      'u26-central-done-mid-light',
      'u26-central-done-mid-dark',
      'u26-central-done-open-light',
      'u26-central-done-open-dark',
      'u26-central-done-batch-light',
      'u26-central-done-batch-dark',
      'u26-central-done-recap-light',
      'u26-central-done-recap-dark',
      'u26-central-log-search-light',
    ]);
  });

  it.each(Object.keys(U26_CENTRAL_DONE_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = await show({ name });
      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
