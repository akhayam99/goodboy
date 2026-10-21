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
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U25_C12_TASK_SCENES } from './c12-tasks';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C12_TASK_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C12_TASK_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const list = (): HTMLElement => screen.getByRole('list', { name: 'Task items' });

const groupNames = (): ReadonlyArray<string> =>
  Array.from(list().querySelectorAll('h2')).map((heading) => heading.textContent ?? '');

describe('c12 task scenes', () => {
  it.each(['c12-tasks-forme', 'c12-tasks-ratelimited', 'c12-issue-pane'] as const)(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const Scene = U25_C12_TASK_SCENES[name];
      const { container } = render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );

  it('registers every state in the scene registry', () => {
    for (const name of Object.keys(U25_C12_TASK_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('opens For me on assigned issues only, three tracker groups capped at five', async () => {
    await mount('c12-tasks-forme');

    expect(groupNames()).toEqual(['Starred', 'GitHub', 'Linear', 'Jira']);
    expect(screen.getByRole('tab', { name: 'For me' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Show all' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Show all \d/ })).toBeNull();
    expect(within(list()).getAllByRole('option').length).toBeLessThanOrEqual(16);
  });

  it('shows All with 1,024 open across five sources', async () => {
    await mount('c12-tasks-all');

    expect(screen.getByText('1,024 open')).toBeDefined();
    expect(groupNames()).toEqual(['Starred', 'Linear', 'Jira', 'Sentry', 'Slack', 'GitHub']);
  });

  it('draws a window of the expanded Linear group and names the position', async () => {
    await mount('c12-tasks-expanded');

    expect(screen.getByText('41 of 412')).toBeDefined();
    expect(within(list()).getAllByRole('option').length).toBeLessThan(412);
  });

  it('lists a looked up issue in Not in Tasks above the groups', async () => {
    await mount('c12-tasks-lookup');

    expect(groupNames()[0]).toBe('Not in Tasks');
    expect(screen.getByRole('option', { name: /HBL-9001/ })).toBeDefined();
  });

  it('puts the rate limited source as one gray line in its group', async () => {
    await mount('c12-tasks-ratelimited');

    expect(screen.getByText('Linear is rate limited.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('opens the Filter menu with sources first', async () => {
    await mount('c12-tasks-filter');

    const menu = screen.getByRole('dialog', { name: 'Task filters' });
    expect(within(menu).getByRole('group', { name: 'Source' })).toBeDefined();
  });

  it('shows the Linear issue in the pane with grouped properties, two PRs and the star', async () => {
    await mount('c12-issue-pane');

    const pane = screen.getByRole('complementary', { name: 'Task' });
    const properties = within(pane).getByRole('group', { name: 'Properties' });
    expect(within(properties).getByRole('region', { name: 'State' })).toBeDefined();
    expect(within(properties).getByRole('region', { name: 'Planning' })).toBeDefined();
    expect(within(properties).getByRole('region', { name: 'Links' })).toBeDefined();
    expect(within(pane).getByRole('button', { name: 'Open full' })).toBeDefined();
    expect(within(pane).getByRole('button', { name: 'Star HBL-412' })).toBeDefined();
    expect(within(pane).queryByText('Linked to')).toBeNull();
  });

  it('hosts a GitHub issue and a Sentry error in the same pane frame', async () => {
    await mount('c12-issue-github');
    expect(
      within(screen.getByRole('complementary', { name: 'Task' })).getByRole('button', {
        name: 'Open full',
      }),
    ).toBeDefined();
    cleanup();

    await mount('c12-issue-sentry');
    expect(
      within(screen.getByRole('complementary', { name: 'Task' })).getByRole('button', {
        name: 'Open full',
      }),
    ).toBeDefined();
  });

  it('edits the description in place', async () => {
    await mount('c12-issue-edit');

    expect(screen.getByRole('textbox', { name: 'Edit description' })).toBeDefined();
  });

  it('opens the issue full page with a way back to Tasks and no Open full', async () => {
    await mount('c12-issue-full');

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByRole('button', { name: 'Tasks' })).toBeDefined();
    expect(within(trail).getByText('HBL-412')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open full' })).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Ledger export times out over 10k rows' }),
    ).toBeDefined();
  });
});
