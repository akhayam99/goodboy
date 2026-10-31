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
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
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

  it('groups the agents by state with one count per group and one summary line', async () => {
    const { container } = mount();

    const tree = await railTree();
    expect(container.querySelector('[data-spawned-summary]')?.textContent).toBe(
      '3 working, 2 waiting, 6 done',
    );
    headOf({ tree, name: 'Working, 3' });
    headOf({ tree, name: 'Waiting, 2' });
    headOf({ tree, name: 'Done, 6' });
    const working = container.querySelector<HTMLElement>('[data-spawned-state="working"]');
    if (working === null) {
      throw new Error('no Working group');
    }
    expect(
      within(working)
        .getAllByRole('treeitem')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([
      'Working, 3',
      'Docs, Write the retry summary, Running',
      'Reviewer, Review the ledger-core diff, Running',
      'Implementer, Fix the applyCredit retry, Running',
    ]);
    expect(working.contains(within(tree).getAllByRole('treeitem')[0] ?? null)).toBe(false);
    expect(within(tree).getAllByRole('treeitem')[0]?.getAttribute('aria-label')).toBe(
      'Auto agent, Make the payments-api retry safe, Running',
    );
  });

  it('folds Done by default and keeps its rows out of the tree', async () => {
    mount();

    const tree = await railTree();
    const done = headOf({ tree, name: 'Done, 6' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(labelsOf({ tree })).toHaveLength(3 + 4 + 2);
    expect(labelsOf({ tree }).some((label) => label.includes('Plan the retry safe'))).toBe(false);
  });

  it('unfolds Done with a click and with the arrow keys, then folds it again', async () => {
    mount();

    const tree = await railTree();
    const done = headOf({ tree, name: 'Done, 6' });
    fireEvent.click(done);
    expect(done.getAttribute('aria-expanded')).toBe('true');
    expect(labelsOf({ tree })).toHaveLength(3 + 4 + 2 + 6);
    within(tree).getByRole('treeitem', { name: 'Planner, Plan the retry safe credit flow, Done' });
    fireEvent.keyDown(done, { key: 'ArrowLeft' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
    expect(labelsOf({ tree })).toHaveLength(3 + 4 + 2);
    fireEvent.keyDown(done, { key: 'ArrowRight' });
    expect(done.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(done, { key: 'Enter' });
    expect(done.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps Working and Waiting open with no chevron to fold them', async () => {
    mount();

    const tree = await railTree();
    for (const name of ['Working, 3', 'Waiting, 2']) {
      const head = headOf({ tree, name });
      expect(head.getAttribute('aria-expanded')).toBeNull();
      fireEvent.click(head);
      expect(labelsOf({ tree })).toHaveLength(3 + 4 + 2);
    }
  });

  it('reads two lines per row: the title, then the role, who asked and the time', async () => {
    mount();

    const tree = await railTree();
    const fix = within(tree).getByRole('treeitem', {
      name: 'Implementer, Fix the applyCredit retry, Running',
    });
    expect(fix.getAttribute('aria-selected')).toBe('true');
    expect(fix.querySelector('[data-spawned-meta]')?.textContent).toBe('Implementer · 6m');
    const relay = within(tree).getByRole('treeitem', {
      name: 'Scout, Check notify-relay callers, Queued',
    });
    expect(relay.querySelector('[data-spawned-meta]')?.textContent).toBe(
      'Scout · from Implementer · queued',
    );
    expect(fix.getAttribute('data-spawned-state-row')).toBe('working');
    expect(relay.getAttribute('data-spawned-state-row')).toBe('resting');
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();

    await railTree();
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
