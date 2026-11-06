// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U36_RUN_PAGES_SCENES } from './run-pages';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U36_RUN_PAGES_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U36_RUN_PAGES_SCENES[name];
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const headOf = (): HTMLElement => {
  const head = [...document.querySelectorAll<HTMLElement>('[data-slot="pane-title-row"]')].at(-1);
  if (head === undefined) {
    throw new Error('no page head');
  }
  return head;
};

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return node;
};

describe('one run page', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U36_RUN_PAGES_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each(['u36-p12-preset-page', 'u36-p12-orch-page'] as const)(
    '%s draws one head, one glance and the same step list',
    async (name) => {
      await mount(name);

      within(headOf()).getByRole('heading', { level: 1 });
      within(headOf()).getByRole('button', { name: /run actions$/ });
      expect(document.querySelectorAll('[data-glance]')).toHaveLength(1);
      screen.getByRole('heading', { level: 2, name: 'Steps' });
      expect(document.querySelectorAll('[data-testid^="run-tree-row-"]').length).toBeGreaterThan(1);
    },
  );

  it('keeps Add step under the list of a preset run and off an orchestrated one', async () => {
    await mount('u36-p12-preset-page');
    within(nodeOf('[data-run-add-step]')).getByRole('button', { name: 'Add step' });
    cleanup();

    await mount('u36-p12-orch-page');
    expect(document.querySelector('[data-run-add-step]')).toBeNull();
  });

  it.each(['u36-p12-preset-page', 'u36-p12-orch-page'] as const)(
    '%s keeps the head menu within five rows and renames in place',
    async (name) => {
      await mount(name);

      fireEvent.click(within(headOf()).getByRole('button', { name: /run actions$/ }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });
      const menu = screen.getByRole('menu');
      expect(within(menu).getAllByRole('menuitem').length).toBeLessThanOrEqual(5);
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Rename' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });
      within(headOf()).getByRole('textbox', { name: 'Rename run' });
    },
  );

  it('double click on the head title renames in place', async () => {
    await mount('u36-p12-preset-page');

    fireEvent.doubleClick(within(headOf()).getByText('Fix flaky tests in the ledger export'));

    within(headOf()).getByRole('textbox', { name: 'Rename run' });
  });

  it('opens the run menu from the keyboard on the head title and starts nothing on Enter or Space', async () => {
    await mount('u36-p12-preset-page');

    const title = within(headOf()).getByText('Fix flaky tests in the ledger export');
    expect(title.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(title, { key: 'Enter' });
    fireEvent.keyDown(title, { key: ' ' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(within(headOf()).queryByRole('textbox')).toBeNull();

    fireEvent.keyDown(title, { key: 'F10', shiftKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const menu = screen.getByRole('menu');
    within(menu).getByRole('menuitem', { name: 'Pause run' });
    within(menu).getByRole('menuitem', { name: 'Copy run summary' });
  });

  it.each(['u36-p12-step-page', 'u36-p12-orch-step-page'] as const)(
    '%s holds step verbs, with no run button in its head',
    async (name) => {
      await mount(name);

      expect(within(headOf()).queryByRole('button', { name: /run actions$/ })).toBeNull();
      within(headOf()).getByText(/^Step \d/);
      within(headOf()).getByRole('button', { name: 'Step actions' });
    },
  );

  it('keeps the run verb on one quiet line of the step page', async () => {
    await mount('u36-p12-step-page');

    const tail = within(nodeOf('[data-run-tail]'));
    tail.getByText('Step 2 done');
    tail.getByRole('button', { name: 'Start step 3' });
  });

  it('reads the reason of an orchestrated step on its page', async () => {
    await mount('u36-p12-orch-step-page');

    expect(nodeOf('[data-step-reason]').textContent).toContain(
      'The batching must be proven on 12,000 rows before any CSV work.',
    );
  });

  it('shows the outcome of a finished preset run, with no Settings and no tail', async () => {
    await mount('u36-p12-run-done');

    expect(screen.queryByRole('button', { name: 'Run settings' })).toBeNull();
    expect(document.querySelector('[data-run-tail]')).toBeNull();
    nodeOf('[data-orchestrated-result]');
    screen.getByRole('button', { name: 'Create report' });
  });
});

describe('the form and the row', () => {
  it('opens How with one line per kind', async () => {
    await mount('u36-p14-form-how-open');

    const kinds = screen.getByRole('tablist', { name: 'What kind of run?' });
    expect(within(kinds).getAllByRole('tab')).toHaveLength(4);
    within(kinds).getByText('Plans each next step as it goes.');
  });

  it('opens the rename field in the row on a double click', async () => {
    await mount('u36-f5-row-rename');

    screen.getByRole('textbox', { name: 'Rename run' });
  });
});

describe('the Branch page', () => {
  it('names the runs on this branch', async () => {
    await mount('u36-f3-branch-runs');

    within(nodeOf('[data-branch-runs-line]')).getByRole('button', { name: /^1 run$/ });
  });
});
