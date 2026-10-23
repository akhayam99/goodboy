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
import { U27_ONE_FLOW_SCENES } from './one-flow';

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
  readonly id: keyof typeof U27_ONE_FLOW_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U27_ONE_FLOW_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const pageLabels = async (): Promise<ReadonlyArray<string>> => {
  const pages = await screen.findByRole('list', { name: 'Pages' }, WAIT);
  return within(pages)
    .getAllByRole('button')
    .map((row) => row.textContent ?? '');
};

describe('the u27 one flow scenes', () => {
  it('registers every before and after scene', () => {
    for (const [id, Scene] of Object.entries(U27_ONE_FLOW_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
    expect(Object.keys(U27_ONE_FLOW_SCENES)).toHaveLength(12);
  });

  it('keeps one session rail entry for runs, current on the run list', async () => {
    mount({ id: 'u27-one-flow-after-entry' });

    const labels = await pageLabels();
    expect(labels.filter((label) => /Orchestrated|Agents|Auto/.test(label))).toEqual([]);
    expect(labels.filter((label) => label.startsWith('Runs'))).toHaveLength(1);
    const current = screen.getByRole('button', { current: 'page' });
    expect(current.textContent?.startsWith('Runs')).toBe(true);
  });

  it('names the run kind on a chip whose popover starts a second run as another kind', async () => {
    mount({ id: 'u27-one-flow-after-routed' });

    const chip = await screen.findByRole(
      'button',
      { name: 'Kind: Workflow · Preset Fix a layout, set at start' },
      WAIT,
    );
    fireEvent.click(chip);
    const popover = await screen.findByRole('dialog', { name: 'Kind' }, WAIT);
    const startAs = within(popover).getByRole('group', { name: 'Start a new run as' });
    expect(
      within(startAs)
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Workflow · Orchestrated', 'Agent · Auto agent']);
    expect(
      within(popover)
        .getAllByRole('tab')
        .map((item) => item.textContent),
    ).toEqual(['Follow it', 'Adapt as it goes']);
    expect(popover.textContent).toContain(
      'Starts a second run with the same goal. This one keeps going.',
    );
    expect(popover.textContent).not.toContain('Start every run in this session');
  });

  it('shows the step Auto added to the preset with its reason', async () => {
    mount({ id: 'u27-one-flow-after-preset' });

    expect(
      await screen.findByText(
        'Why: Added to the preset: the scout found the billing table scrolls sideways at 390px',
        { exact: false },
        WAIT,
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^Kind: Workflow · Preset Fix a layout/ }));
    const popover = await screen.findByRole('dialog', { name: 'Kind' }, WAIT);
    expect(popover.querySelector('[data-run-kind-why]')?.textContent).toContain('· 1 change');
    expect(document.querySelector('[data-preset-facts]')).toBeNull();
    const tag = document.querySelector('[data-plan-change="added"]');
    expect(tag?.textContent).toBe('Added');
  });

  it('lists every run of the session newest first, old kinds included', async () => {
    mount({ id: 'u27-one-flow-after-runs' });

    const list = await screen.findByRole('list', { name: 'Runs' }, WAIT);
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(4);
    for (const origin of [
      'Workflow · Preset Fix a layout',
      'Workflow · Orchestrated',
      'Agent · Auto agent',
      'Agent · Scout',
    ]) {
      expect(within(list).getByText(origin)).toBeDefined();
    }
    expect(
      rows.filter((row) => row.getAttribute('aria-label')?.includes(', Workflow, ') === true),
    ).toHaveLength(2);
  });
});
