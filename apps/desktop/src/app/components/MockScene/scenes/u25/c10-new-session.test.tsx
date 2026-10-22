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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { WORKSPACE_ID } from '../BoardScene';
import { U25_C10_NEW_SESSION_SCENES } from './c10-new-session';

const SETTLE_MS = 2_000;

const WorkflowScene = U25_C10_NEW_SESSION_SCENES['c10-start-workflow'];

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
  ['c10-new-report', 'Write a report'],
  ['c10-new-wireframe', 'Draw a wireframe'],
];

const pickedNames = () =>
  screen
    .getAllByRole('button', { name: /^Remove / })
    .map((chip) => chip.getAttribute('aria-label'));

describe('the c10 New session scenes', () => {
  it('registers one scene per state of the New session page and the New forms', () => {
    expect(Object.keys(U25_C10_NEW_SESSION_SCENES).sort()).toEqual([
      'c10-new-menu',
      'c10-new-report',
      'c10-new-wireframe',
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

  it('c10-start-task attaches HBL-412 above Start a run with one Start', async () => {
    await mount({ id: 'c10-start-task' });

    expect(screen.getByRole('list', { name: 'Picked issues' }).textContent).toContain('HBL-412');
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Runs as/ })).toBeNull();
  });

  it('c10-start-workflow is the Start a run field with the goal and the two project chips', async () => {
    await mount({ id: 'c10-start-workflow' });

    expect(screen.getByRole('textbox', { name: 'Start a run' })).toHaveProperty(
      'value',
      'Make ledger posts in payments-api safe to retry end to end, and keep ledger-core balances unchanged',
    );
    expect(pickedNames()).toEqual(['Remove payments-api', 'Remove ledger-core']);
    expect(screen.queryByRole('button', { name: 'Start an auto' })).toBeNull();
  });

  it('c10-start-workflow has no accessibility violation', async () => {
    const { container } = render(
      <ToastProvider>
        <WorkflowScene />
      </ToastProvider>,
    );
    await settle();
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });

  it('c10-start-projects opens the picker over 50 projects, searched for pay', async () => {
    await mount({ id: 'c10-start-projects' });

    const workspaceProjects = useAppStore
      .getState()
      .projects.filter((project) => project.workspaceId === WORKSPACE_ID);
    expect(workspaceProjects).toHaveLength(50);
    const search = screen.getByRole('combobox', { name: 'Search folders' });
    expect(search).toHaveProperty('value', 'pay');
    const listbox = screen.getByRole('listbox', { name: 'Folder' });
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    expect(within(listbox).getByRole('option', { name: /payments-api/ })).toBeDefined();
    expect(within(listbox).queryAllByText(/^(Suggested|All folders)$/).length).toBeGreaterThan(0);
    expect(pickedNames()).toEqual(['Remove payments-api', 'Remove ledger-core']);
  });

  it('c10-start-failed keeps the draft, says why and turns Start into Retry', async () => {
    await mount({ id: 'c10-start-failed' });

    expect(
      screen.getByText(/The branch hl\/retry-guard already exists in payments-api/),
    ).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Start a run' })).toHaveProperty(
      'value',
      'Make ledger posts in payments-api safe to retry end to end, and keep ledger-core balances unchanged',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveProperty('disabled', false);
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
  });

  it('c10-new-menu opens the Overview New menu: Start a run, a report or a wireframe', async () => {
    await mount({ id: 'c10-new-menu' });

    const menu = screen.getByRole('menu', { name: 'New' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Start a run', 'Write a report', 'Draw a wireframe']);
  });

  it.each(FORM_SCENES)('%s opens the %s form in the drawer', async (id, form) => {
    await mount({ id });

    expect(screen.getByRole('region', { name: form })).toBeDefined();
  });
});
