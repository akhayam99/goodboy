// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { runA11yCheck } from '../../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../../..';
import { U31_RAIL_SCENES } from './rail';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
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
  localStorage.clear();
});

const mount = () => {
  const Scene = U31_RAIL_SCENES['u31-rail'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const railTree = async (): Promise<HTMLElement> =>
  screen.findByRole('tree', { name: 'Auto agents' }, WAIT);

type TreeParams = {
  readonly tree: HTMLElement;
};

const labelsOf = ({ tree }: TreeParams): ReadonlyArray<string> =>
  within(tree)
    .getAllByRole('treeitem')
    .map((item) => item.getAttribute('aria-label') ?? '');

type HeadParams = {
  readonly tree: HTMLElement;
  readonly name: string;
};

const headOf = ({ tree, name }: HeadParams): HTMLElement =>
  within(tree).getByRole('treeitem', { name });

describe('the u31 rail scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_RAIL_SCENES)).toEqual(['u31-rail']);
    expect(MOCK_SCENES['u31-rail']).toBe(U31_RAIL_SCENES['u31-rail']);
  });

  it('frames the capture on one element 680px wide whose padding sits on an inner element', async () => {
    const { container } = mount();

    const tree = await railTree();
    const frame = container.querySelector<HTMLElement>('[data-shot]');
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
    expect(frame?.firstElementChild?.contains(tree)).toBe(true);
  });

  it('draws the agents top down with the Auto row first and no state groups', async () => {
    const { container } = mount();

    const tree = await railTree();
    expect(container.querySelector('[data-spawned-summary]')).toBeNull();
    expect(container.querySelector('[data-spawned-state]')).toBeNull();
    expect(labelsOf({ tree })[0]).toBe('Auto agent, Make the payments-api retry safe, Running');
    expect(
      within(tree)
        .getByRole('treeitem', { name: 'Implementer, Fix the applyCredit retry, Running' })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();

    await railTree();
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
