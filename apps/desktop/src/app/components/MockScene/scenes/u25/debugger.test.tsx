// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_DEBUGGER_SCENES } from './debugger';

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
  const Scene = U25_DEBUGGER_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown Debugger scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('Debugger scenes', () => {
  it('opens the options scene on the recommended option', () => {
    show({ name: 'debugger-drawer-options' });
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(within(drawer).getByRole('button', { name: 'Start option A' })).toBeDefined();
  });
  it('opens the log scene with the log folded', () => {
    show({ name: 'debugger-drawer-ci-log' });
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(
      within(drawer)
        .getByRole('button', { name: /^payments-api \/ test/ })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });
  it.each(Object.keys(U25_DEBUGGER_SCENES))('%s has no accessibility violations', async (name) => {
    const { container } = show({ name });
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
