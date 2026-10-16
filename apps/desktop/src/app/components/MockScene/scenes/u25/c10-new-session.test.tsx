// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { WORKSPACE_ID } from '../BoardScene';
import { U25_C10_NEW_SESSION_SCENES } from './c10-new-session';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U25_C10_NEW_SESSION_SCENES;

type MountParams = {
  readonly id: SceneId;
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async ({ id }: MountParams): Promise<void> => {
  const Scene = U25_C10_NEW_SESSION_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const FORM_SCENES: ReadonlyArray<readonly [SceneId, string]> = [
  ['c10-new-run', 'Run a workflow'],
  ['c10-new-orchestrate', 'Orchestrate'],
  ['c10-new-agent', 'Start agent'],
  ['c10-new-auto', 'Start Auto'],
  ['c10-new-report', 'Report'],
  ['c10-new-wireframe', 'Wireframe'],
];

const pickedNames = () =>
  screen
    .getAllByRole('button', { name: /^Remove / })
    .map((chip) => chip.getAttribute('aria-label'));

describe('the c10 New session scenes', () => {
  it('registers one scene per state of the New session page and the New forms', () => {
    expect(Object.keys(U25_C10_NEW_SESSION_SCENES).sort()).toEqual([
      'c10-new-agent',
      'c10-new-auto',
      'c10-new-menu',
      'c10-new-orchestrate',
      'c10-new-report',
      'c10-new-run',
      'c10-new-wireframe',
      'c10-start-agent',
      'c10-start-auto',
      'c10-start-failed',
      'c10-start-orchestrate',
      'c10-start-projects',
      'c10-start-task',
      'c10-start-workflow',
    ]);
    for (const [id, Scene] of Object.entries(U25_C10_NEW_SESSION_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('c10-start-task picks HBL-412 into one block with one Start from HBL-412', async () => {
    await mount({ id: 'c10-start-task' });

    expect(screen.getByRole('tablist', { name: 'How to work on it' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start from HBL-412' })).toBeDefined();
  });

  it('c10-start-workflow draws the preset steps, the two project chips and Start run', async () => {
    await mount({ id: 'c10-start-workflow' });

    expect(screen.getByRole('button', { name: 'Model for Scout the retry path' })).toBeDefined();
    expect(pickedNames()).toEqual(['Remove payments-api', 'Remove ledger-core']);
    expect(screen.getAllByRole('button', { name: 'Start run' })).toHaveLength(1);
  });

  it('c10-start-orchestrate draws the goal, two project chips and one Start orchestration', async () => {
    await mount({ id: 'c10-start-orchestrate' });

    expect(screen.getByRole('textbox', { name: 'Goal' })).toBeDefined();
    expect(pickedNames()).toEqual(['Remove payments-api', 'Remove ledger-core']);
    expect(screen.getAllByRole('button', { name: 'Start orchestration' })).toHaveLength(1);
    expect(screen.queryByText('Likely steps')).toBeNull();
  });

  it('c10-start-agent asks for Scout with the model and the project the agent works in', async () => {
    await mount({ id: 'c10-start-agent' });

    expect(screen.getByRole('textbox', { name: 'Scout focus' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Role: Scout' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Project: payments-api' })).toBeDefined();
    expect(pickedNames()).toEqual(['Remove payments-api', 'Remove ledger-core']);
  });

  it('c10-start-auto is the Auto form with its Experimental chip and Start Auto', async () => {
    await mount({ id: 'c10-start-auto' });

    expect(screen.getByRole('region', { name: 'Auto' })).toBeDefined();
    expect(screen.getByText('Experimental')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start Auto' })).toBeDefined();
  });

  it('c10-start-projects opens the picker over 50 projects, searched for pay', async () => {
    await mount({ id: 'c10-start-projects' });

    const workspaceProjects = useAppStore
      .getState()
      .projects.filter((project) => project.workspaceId === WORKSPACE_ID);
    expect(workspaceProjects).toHaveLength(50);
    const search = screen.getByRole('combobox', { name: 'Search projects' });
    expect(search).toHaveProperty('value', 'pay');
    const listbox = screen.getByRole('listbox', { name: 'Project' });
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    expect(within(listbox).getByRole('option', { name: /payments-api/ })).toBeDefined();
    expect(within(listbox).queryAllByText(/^(Suggested|All projects)$/).length).toBeGreaterThan(0);
    expect(pickedNames()).toEqual(['Remove payments-api', 'Remove ledger-core']);
  });

  it('c10-start-failed keeps the draft, says why and keeps the primary as the retry', async () => {
    await mount({ id: 'c10-start-failed' });

    expect(
      screen.getByText(/The branch hl\/retry-guard already exists in payments-api/),
    ).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveProperty(
      'value',
      'Make ledger posts in payments-api safe to retry end to end, and keep ledger-core balances unchanged',
    );
    expect(screen.getByRole('button', { name: 'Start orchestration' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
  });

  it('c10-new-menu opens the Overview New menu with one item per form', async () => {
    await mount({ id: 'c10-new-menu' });

    const menu = screen.getByRole('menu', { name: 'New' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Run a workflow', 'Orchestrate', 'Start agent', 'Report', 'Wireframe']);
  });

  it.each(FORM_SCENES)('%s opens the %s form in the drawer', async (id, form) => {
    await mount({ id });

    expect(screen.getByRole('region', { name: form })).toBeDefined();
  });
});
