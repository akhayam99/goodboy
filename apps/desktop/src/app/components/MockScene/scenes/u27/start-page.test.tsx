// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
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

  it('opens on four kinds with none picked, and says Auto picks', async () => {
    mount({ id: 'u27-start-page-after-choice' });

    const kinds = await screen.findByRole('tablist', { name: 'What kind of run?' }, WAIT);
    expect(
      within(kinds)
        .getAllByRole('tab')
        .map((tab) => [tab.textContent, tab.getAttribute('aria-selected')]),
    ).toEqual([
      ['Auto', 'false'],
      ['Agent', 'false'],
      ['Orchestrated', 'false'],
      ['Preset', 'false'],
    ]);
    screen.getByText('Auto picks how to run it. Or pick a kind.');
  });

  it('gives the agent a role and a model, Edits, and no limit', async () => {
    mount({ id: 'u27-start-page-after-agent-form' });

    const row = within(await screen.findByRole('group', { name: 'Run settings' }, WAIT));
    expect(row.getByRole('combobox', { name: 'Role' }).textContent).toContain('Scout');
    row.getByRole('button', { name: /^Model: / });
    row.getByRole('button', { name: /^Edits: / });
    expect(row.queryByText(/Limit/)).toBeNull();
    expect(row.queryByRole('button', { name: /^Asks you/ })).toBeNull();
    screen.getByRole('button', { name: 'Start Scout' });
  });

  it('shows the preset with its steps, Follow it or Adapt as it goes, and the task attached', async () => {
    mount({ id: 'u27-start-page-after-preset-form' });

    const preset = await screen.findByRole('combobox', { name: 'Preset' }, WAIT);
    expect(preset.textContent).toContain('Fix a layout');
    expect(
      within(screen.getByRole('list', { name: 'Preset steps' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    screen.getByRole('tablist', { name: 'With the preset' });
    const row = within(screen.getByRole('group', { name: 'Run settings' }));
    row.getByRole('button', { name: /^Asks you: Every step/ });
    expect(row.getByRole('combobox', { name: 'Where' }).textContent).toContain('harbor-portal');
    screen.getByText('Member pages drift left on wide screens');
    screen.getByRole('button', { name: 'Start workflow' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove HBR-142' }));
    expect(await screen.findByRole('combobox', { name: 'Pick from Tasks' }, WAIT)).toBeDefined();
  });

  it('keeps Auto picks as the unpicked state of the same form', async () => {
    mount({ id: 'u27-start-page-after-auto-picks' });

    const kinds = await screen.findByRole('tablist', { name: 'What kind of run?' }, WAIT);
    expect(
      within(kinds)
        .getAllByRole('tab')
        .some((tab) => tab.getAttribute('aria-selected') === 'true'),
    ).toBe(false);
    screen.getByText(/^Starts[ ]as/);
    fireEvent.click(within(kinds).getByRole('tab', { name: /^Orchestrated/ }));
    expect(
      (await within(kinds).findByRole('tab', { name: /^Orchestrated/ })).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
  });
});
