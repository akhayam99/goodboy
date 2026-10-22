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

  it('says what Auto chose on a run and offers the change of shape, preset and closeness', async () => {
    mount({ id: 'u27-one-flow-after-routed' });

    const route = await screen.findByRole('group', { name: 'How Auto runs this' }, WAIT);
    expect(route.textContent).toContain('Plan from Fix a layout, 3 steps');
    fireEvent.click(within(route).getByRole('button', { name: /Change/ }));
    const menu = await screen.findByRole('menu', { name: 'How Auto runs this' }, WAIT);
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      'A plan with steps',
      'One agent that starts what it needs',
      'Fix a layout',
      'No preset',
      'Follow the preset',
      'Adapt as it goes',
      'Start every run in this session like this',
    ]);
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
    const route = screen.getByRole('group', { name: 'How Auto runs this' });
    expect(route.textContent).toContain('Adapt as it goes·1 change');
    expect(document.querySelector('[data-preset-facts]')).toBeNull();
    expect(screen.getAllByText('1 change')).toHaveLength(1);
    const tag = document.querySelector('[data-plan-change="added"]');
    expect(tag?.textContent).toBe('Added');
  });

  it('lists every run of the session newest first, old kinds included', async () => {
    mount({ id: 'u27-one-flow-after-runs' });

    const list = await screen.findByRole('list', { name: 'Runs' }, WAIT);
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(4);
    for (const origin of [
      'Was a preset run · Fix a layout',
      'Was an orchestrated run',
      'Was an Auto conversation',
      'Was an agent · Scout',
    ]) {
      expect(within(list).getByText(origin)).toBeDefined();
    }
    expect(
      rows.filter((row) => row.getAttribute('aria-label')?.includes(', Plan, ') === true),
    ).toHaveLength(2);
  });
});
