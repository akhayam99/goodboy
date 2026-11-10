// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { startSettingsRowOf } from '../../../../../__tests__/helpers/startSettingsRowOf';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { START_KIND_COPY } from '../../../../../features/session/startKind/startKindCopy';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U27_START_PAGE_SCENES } from './start-page';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: keyof typeof U27_START_PAGE_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U27_START_PAGE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u27 start page scenes', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U27_START_PAGE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
    expect(Object.keys(U27_START_PAGE_SCENES)).toHaveLength(8);
  });

  it('opens on four kinds with Auto picked, and says Auto picks', async () => {
    mount({ id: 'u27-start-page-after-choice' });

    fireEvent.click(await screen.findByRole('button', { name: /^How: Auto/ }, WAIT));
    const kinds = await screen.findByRole('tablist', { name: 'What kind of run?' }, WAIT);
    expect(
      within(kinds)
        .getAllByRole('tab')
        .map((tab) => tab.getAttribute('aria-selected')),
    ).toEqual(['true', 'false', 'false', 'false']);
    for (const name of [/^Auto/, /^Agent/, /^Orchestrated/, /^Preset/]) {
      within(kinds).getByRole('tab', { name });
    }
    expect(screen.getAllByText('Auto picks how to run it. Or pick a kind.').length).toBeGreaterThan(
      0,
    );
  });

  it('gives the agent a role, Edits and no limit, and its model in the message box', async () => {
    mount({ id: 'u27-start-page-after-agent-form' });

    const row = startSettingsRowOf({
      group: await screen.findByRole('group', { name: 'Run settings' }, WAIT),
    });
    expect(row.getByRole('combobox', { name: 'Role' }).textContent).toContain('Scout');
    expect(row.queryByRole('button', { name: /^Model: / })).toBeNull();
    const goal = screen.getByRole('textbox', { name: START_KIND_COPY.goal });
    const box = goal.closest<HTMLElement>('[data-prompt-field]');
    expect(within(box ?? document.body).getByRole('button', { name: /^Model: / })).toBeDefined();
    row.getByRole('button', { name: /^Edits: / });
    expect(row.queryByText(/Limit/)).toBeNull();
    expect(row.queryByRole('button', { name: /^Asks you/ })).toBeNull();
    screen.getByRole('button', { name: 'Start' });
  });

  it('shows the preset with its steps, Keep steps or May change steps, and the task attached', async () => {
    mount({ id: 'u27-start-page-after-preset-form' });

    const preset = await screen.findByRole('combobox', { name: 'Preset' }, WAIT);
    expect(preset.textContent).toContain('Fix a layout');
    expect(
      within(screen.getByRole('list', { name: 'Preset steps' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    screen.getByRole('tablist', { name: 'With the preset' });
    const row = startSettingsRowOf({ group: screen.getByRole('group', { name: 'Run settings' }) });
    row.getByRole('button', { name: /^Asks you: Every step/ });
    expect(row.getByRole('combobox', { name: 'Projects' }).textContent).toContain('harbor-portal');
    screen.getByText('Member pages drift left on wide screens');
    screen.getByRole('button', { name: 'Start' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove HBR-142' }));
    expect(await screen.findByRole('combobox', { name: 'Pick from Tasks' }, WAIT)).toBeDefined();
  });

  it('keeps Auto picks as the unpicked state of the same form', async () => {
    mount({ id: 'u27-start-page-after-auto-picks' });

    fireEvent.click(await screen.findByRole('button', { name: /^How: Auto/ }, WAIT));
    const kinds = await screen.findByRole('tablist', { name: 'What kind of run?' }, WAIT);
    expect(within(kinds).getByRole('tab', { name: /^Auto/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    screen.getByText(/^Starts[ ]as/);
    fireEvent.click(within(kinds).getByRole('tab', { name: /^Orchestrated/ }));
    await screen.findByRole('button', { name: /^How: Orchestrated/ }, WAIT);
  });
});
