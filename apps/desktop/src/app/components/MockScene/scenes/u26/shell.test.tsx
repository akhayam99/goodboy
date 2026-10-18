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
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('u26-rail-projects-focus puts keyboard focus on the ledger-core plus', async () => {
    await mount('u26-rail-projects-focus');

    expect(document.activeElement?.getAttribute('aria-label')).toBe('New branch in ledger-core');
  });

  it('u26-rail-projects-picker opens the picker with the spare projects and Connect', async () => {
    await mount('u26-rail-projects-picker');

    const picker = within(screen.getByRole('dialog', { name: 'Add project' }));
    expect(picker.getByRole('button', { name: 'Add notify-relay' })).toBeDefined();
    expect(picker.getByRole('button', { name: 'Add cascadia-web' })).toBeDefined();
    expect(picker.getByRole('button', { name: 'Connect a repo or folder' })).toBeDefined();
  });

  it('u26-sidebar-signals marks Sessions with the warning dot and keeps needs you out of the top bar', async () => {
    await mount('u26-sidebar-signals');

    const door = document.querySelector('[data-side-column] [data-column-door="board"]');
    expect(door?.getAttribute('aria-label')).toMatch(/^Sessions, 2 need you: /);
    expect(door?.querySelector('[data-door-signal="warning"]')).not.toBeNull();
    expect(document.querySelector('[data-top-bar]')?.textContent ?? '').not.toMatch(/need you/);
    expect(document.querySelector('[data-column-door="impact"]')).not.toBeNull();
  });

  it('u26-sidebar-ports puts the pinned port down dot on the Monitoring door, none in the top bar', async () => {
    await mount('u26-sidebar-ports');

    const door = document.querySelector('[data-side-column] [data-column-door="monitoring"]');
    expect(door?.getAttribute('aria-label')).toBe('Monitoring, pinned port :5173 is down');
    expect(door?.querySelector('[data-door-signal="warning"]')).not.toBeNull();
    expect(document.querySelector('[data-top-bar] [aria-label^="Monitoring"]')).toBeNull();
    expect(document.querySelector('[data-top-bar]')?.textContent ?? '').not.toMatch(/port down/);
  });

  it('u26-sidebar-impact marks the Impact door current with no band', async () => {
    const container = await mount('u26-sidebar-impact');

    expect(
      container.querySelector('[data-column-door="impact"]')?.getAttribute('aria-current'),
    ).toBe('page');
    expect(container.querySelector('[data-studio-band]')).toBeNull();
  });

  it('u26-filter-default opens on Sort and Group with no Reset', async () => {
    await mount('u26-filter-default');

    const dialog = within(screen.getByRole('dialog', { name: 'Filter sessions' }));
    expect(dialog.getByRole('combobox', { name: 'Sort' })).toBeDefined();
    expect(dialog.getByRole('combobox', { name: 'Group' })).toBeDefined();
    expect(dialog.queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(document.querySelector('[data-filter-dot]')).toBeNull();
  });

  it('u26-filter-active checks the stage, turns on Show archived and offers Reset', async () => {
    await mount('u26-filter-active');

    const dialog = within(screen.getByRole('dialog', { name: 'Filter sessions' }));
    const needsYou = dialog.getByRole('checkbox', { name: /^Needs you, / });
    expect(needsYou instanceof HTMLInputElement && needsYou.checked).toBe(true);
    expect(
      dialog.getByRole('switch', { name: /^Show archived/ }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(dialog.getByRole('combobox', { name: 'Sort' }).textContent).toContain('Last activity');
    expect(dialog.getByRole('button', { name: 'Reset' })).toBeDefined();
    expect(document.querySelector('[data-filter-dot="active"]')).not.toBeNull();
  });

  it('u26-rail-foot draws the spend, Archive and Delete on one row', async () => {
    await mount('u26-rail-foot');

    const foot = document.querySelector<HTMLElement>('[data-session-foot]');
    expect(foot?.querySelector('[data-session-spend]')).not.toBeNull();
    expect(
      Array.from(foot?.querySelectorAll('[data-session-foot-action]') ?? []).map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Archive session', 'Delete session']);
  });

  it('u26-rail-foot-archive asks before archiving and names the running agent', async () => {
    await mount('u26-rail-foot-archive');

    const dialog = within(screen.getByRole('dialog', { name: 'Archive session?' }));
    expect(dialog.getByText(/still running in this session/)).toBeDefined();
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
