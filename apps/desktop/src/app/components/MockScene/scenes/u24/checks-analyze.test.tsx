// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_CHECKS_ANALYZE_SCENES } from './checks-analyze';

beforeAll(async () => {
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
const show = ({ name }: Params) => {
  const Scene = U24_CHECKS_ANALYZE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown checks scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('checks analysis scenes', () => {
  it('opens the analysis beside the page and preserves its selected agent', async () => {
    const store = await importStore();
    const { container } = show({ name: 'branch-checks-analyzing' });
    const row = document.querySelector<HTMLElement>('[data-check-row] button');
    if (row === null) {
      throw new Error('The failing check row is missing');
    }
    fireEvent.click(row);
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(
      screen.getByRole('complementary', { name: 'Side panel' }).getAttribute('data-drawer-sizing'),
    ).toBe('side');
    expect(container.querySelector('[data-container="page"]')?.contains(drawer)).toBe(false);
    expect(store.getState().drawer?.kind).toBe('check-analysis');
    expect(store.getState().selectedAgentId).toEqual({});
    for (const name of ['Finding', 'Proposed fix']) {
      expect(within(drawer).getByRole('heading', { level: 3, name })).toBeDefined();
    }
    for (const name of ['What it was given', 'Failed log tail']) {
      expect(within(drawer).getByRole('button', { name })).toBeDefined();
    }
    expect(within(drawer).queryByRole('heading', { level: 3, name: 'Status' })).toBeNull();
  });
  it('renders the proposal as a mini diff with its file and counts', () => {
    show({ name: 'debugger-drawer-proposal' });
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(
      within(
        within(drawer).getByRole('region', { name: 'Proposed diff for src/ledger.ts' }),
      ).getByText('src/ledger.ts'),
    ).toBeDefined();
    expect(within(drawer).getByText('+1')).toBeDefined();
    expect(within(drawer).getByText('−0')).toBeDefined();
    expect(within(drawer).getByText('Sonnet 5.5')).toBeDefined();
  });
  it.each(Object.keys(U24_CHECKS_ANALYZE_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
