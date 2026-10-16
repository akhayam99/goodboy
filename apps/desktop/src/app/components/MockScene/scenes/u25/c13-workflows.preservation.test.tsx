// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    listRemovedSeededWorkflowIds: async () => [],
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { U25_C13_WORKFLOWS_SCENES } from './c13-workflows';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const settle = (ms = 150): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));

const renderWorkflows = async (): Promise<void> => {
  const Scene = U25_C13_WORKFLOWS_SCENES['c13-workflows'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle(400);
};

const grid = (): HTMLElement => screen.getByRole('list', { name: 'Workflows' });

describe('SPEC3 9.9 Workflows rows stay reachable from the Workflows grid', () => {
  it('keeps the Run defaults and Saved steps tabs in the switch', async () => {
    await renderWorkflows();

    expect(screen.getByRole('tab', { name: 'Run defaults' })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Saved steps/ })).toBeDefined();
  });

  it('keeps Built in, Edited, role glyphs and the step count on the row', async () => {
    await renderWorkflows();

    const builtin = within(grid()).getByRole('button', { name: 'Open Fix a bug' });
    expect(builtin.textContent).toContain('Built in');
    const edited = within(grid()).getByRole('button', { name: 'Open Refactor' });
    expect(edited.textContent).toContain('Edited');
    const flaky = within(grid()).getByRole('button', { name: 'Open Fix flaky tests' });
    expect(flaky.textContent).toContain('3 steps');
    expect(flaky.querySelectorAll('.rounded-full')).toHaveLength(3);
  });

  it('keeps Import and Restore built-in workflows in the title row', async () => {
    await renderWorkflows();

    expect(screen.getByRole('button', { name: /^Import/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restore built-in workflows' })).toBeDefined();
  });

  it('opens the editor from the row, with Delete in its actions', async () => {
    await renderWorkflows();

    fireEvent.click(within(grid()).getByRole('button', { name: 'Open Fix flaky tests' }));
    await settle();

    expect(screen.queryByRole('list', { name: 'Workflows' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Workflow actions' }));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeDefined();
  });

  it('turns Last run into the runs pane of that workflow', async () => {
    await renderWorkflows();

    fireEvent.click(within(grid()).getByRole('button', { name: /^Runs of Fix flaky tests/ }));
    await settle();

    expect(screen.getByRole('region', { name: 'Fix flaky tests' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Runs of Fix flaky tests' })).toBeDefined();
  });
});
