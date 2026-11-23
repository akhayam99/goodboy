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
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26_SHELL_SCENES } from './shell';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U26_SHELL_SCENES;

const NAMES: ReadonlyArray<SceneName> = Object.keys(U26_SHELL_SCENES).filter(
  (name): name is SceneName => Object.hasOwn(U26_SHELL_SCENES, name),
);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: SceneName): Promise<Element> => {
  const Scene = U26_SHELL_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await settle();
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const projectRow = (name: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(
    `[data-card-project="${name}"] [data-project-row]`,
  );
  if (row === null) {
    throw new Error(`no project row ${name}`);
  }
  return row;
};

describe('the u26 shell scenes', () => {
  it('registers every scene', () => {
    for (const name of NAMES) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('u26-rail-projects gives each repo row its own plus and the folder row none', async () => {
    await mount('u26-rail-projects');

    expect(
      within(projectRow('payments-api')).getByRole('button', {
        name: 'New branch in payments-api',
      }),
    ).toBeDefined();
    expect(
      within(projectRow('ledger-core')).getByRole('button', { name: 'New branch in ledger-core' }),
    ).toBeDefined();
    expect(
      within(projectRow('acme-runbooks')).queryByRole('button', { name: /^New branch/ }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Mount a folder' })).toBeDefined();
  });

  it('u26-rail-projects-focus puts keyboard focus on the ledger-core plus', async () => {
    await mount('u26-rail-projects-focus');

    expect(document.activeElement?.getAttribute('aria-label')).toBe('New branch in ledger-core');
  });

  it('u26-rail-projects-picker opens the picker with the spare projects and Connect', async () => {
    await mount('u26-rail-projects-picker');

    const picker = within(screen.getByRole('dialog', { name: 'Mount a folder' }));
    expect(picker.getByRole('button', { name: 'Mount notify-relay' })).toBeDefined();
    expect(picker.getByRole('button', { name: 'Mount cascadia-web' })).toBeDefined();
    expect(picker.getByRole('button', { name: 'Choose a folder…' })).toBeDefined();
  });

  it('u26-sidebar-signals marks Board with the count and says nothing about it in the top bar', async () => {
    await mount('u26-sidebar-signals');

    const door = document.querySelector('[data-shell-rail] [data-shell-rail-item="board"]');
    expect(door?.getAttribute('aria-label')).toMatch(/^Board, 2 sessions need you: /);
    expect(
      door?.closest('[data-slot="shell-rail-item"]')?.querySelector('[data-slot="rail-mark"]')
        ?.textContent,
    ).toBe('2');
    expect(document.querySelector('[data-top-bar] [data-now-needs-you]')).toBeNull();
    expect(document.querySelector('[data-shell-rail-item="impact"]')).not.toBeNull();
  });

  it('u26-sidebar-impact marks the Impact door current with no band', async () => {
    const container = await mount('u26-sidebar-impact');

    expect(
      container.querySelector('[data-shell-rail-item="impact"]')?.getAttribute('aria-current'),
    ).toBe('page');
    expect(container.querySelector('[data-studio-band]')).toBeNull();
  });

  it('u26-rail-foot-archive asks from the session menu before archiving and names the running agent', async () => {
    await mount('u26-rail-foot-archive');

    expect(document.querySelector('[data-session-foot]')).toBeNull();

    const dialog = within(screen.getByRole('dialog', { name: 'Stop 1 agent and archive?' }));
    expect(dialog.getByText(/Archive stops it first/)).toBeDefined();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
