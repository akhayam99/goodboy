// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_B_MONITORING_SCENES } from './b-monitoring';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

type SceneParams = {
  readonly name: keyof typeof U25_B_MONITORING_SCENES;
};

const ready = async ({ name }: SceneParams) => {
  const Scene = U25_B_MONITORING_SCENES[name];
  render(<Scene />);
  await waitFor(() => expect(screen.getByRole('region', { name: 'Pinned' })).toBeDefined(), {
    timeout: 4000,
  });
};

type NameParams = {
  readonly name: string;
};

const layer = ({ name }: NameParams): HTMLElement => screen.getByRole('region', { name });

describe('the busy Mac', () => {
  it('collapses the docker process into one row that lists its ports', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const workspace = layer({ name: 'From workspace' });

    expect(within(workspace).getByText(':80 :2019 :3030 +6')).toBeDefined();
    expect(
      within(workspace).getByRole('button', { name: 'Show 9 ports of com.docker.backend' }),
    ).toBeDefined();
    expect(workspace.querySelectorAll('[data-port-row="3306"]')).toHaveLength(0);
  });

  it('opens the per-port rows from the shared row', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const workspace = layer({ name: 'From workspace' });

    fireEvent.click(
      within(workspace).getByRole('button', { name: 'Show 9 ports of com.docker.backend' }),
    );

    for (const port of [80, 2019, 3030, 3031, 3306, 4222, 5432, 6379, 8222]) {
      expect(workspace.querySelectorAll(`[data-port-row="${port}"]`)).toHaveLength(1);
    }
  });

  it('folds free ports into one line after the ports in use', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const workspace = layer({ name: 'From workspace' });
    const fold = within(workspace).getByRole('button', { name: /^5 free: :5001 :5002/ });

    expect(workspace.querySelectorAll('[data-port-row="5001"]')).toHaveLength(0);
    fireEvent.click(fold);

    expect(workspace.querySelectorAll('[data-port-row="5001"]')).toHaveLength(1);
    const items = [...workspace.querySelectorAll(':scope > ul > li')];
    const sharedAt = items.findIndex((item) => item.hasAttribute('data-shared-pid'));
    const foldAt = items.findIndex((item) => item.contains(fold));

    expect(sharedAt).toBeGreaterThanOrEqual(0);
    expect(foldAt).toBeGreaterThan(sharedAt);
  });

  it('keeps a pinned port with its description in use', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const pinned = layer({ name: 'Pinned' });

    expect(within(pinned).getByText('Ledger web')).toBeDefined();
    expect(within(pinned).getByRole('button', { name: '1 free: :9000' })).toBeDefined();
  });

  it('names the terminal owners on one line without a chip', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const goodboy = layer({ name: 'Run by Goodboy' });

    expect(within(goodboy).getAllByText(/^Terminal · /).length).toBeGreaterThan(0);
    expect(within(goodboy).queryByRole('button', { name: /^Open session/ })).toBeNull();
  });

  it('shows the command line from the whole row, not from a chevron', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const row = document.querySelector('[data-port-row="4001"]');
    if (!(row instanceof HTMLElement)) {
      throw new Error('no row for :4001');
    }

    fireEvent.click(within(row).getByRole('button', { name: 'Show command line' }));

    expect(screen.getByRole('group', { name: 'Command line' }).textContent).toContain('mock-api');
  });

  it('opens the shared rows and the free fold on its own in the expanded scene', async () => {
    await ready({ name: 'b-monitoring-expanded' });

    await waitFor(() => expect(document.querySelector('[data-port-row="3306"]')).not.toBeNull(), {
      timeout: 6000,
    });
  });
});

describe('the column header and the terminal rows', () => {
  it('names the columns once at the top of the list', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const header = document.querySelector('[data-column-header]');

    expect(header?.textContent).toBe('PortLabelOpened byProcessUpCPUMemory');
    expect(document.querySelectorAll('[data-column-header]')).toHaveLength(1);
  });

  it('leaves the Port cell empty and shows the process, its pid and the place for a terminal row', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const goodboy = layer({ name: 'Run by Goodboy' });
    const row = goodboy.querySelector('[data-started-row]');

    expect(row?.textContent).not.toContain('no port');
    expect(row?.textContent).toContain('zsh');
    expect(row?.textContent).toContain('6301');
    expect(row?.textContent).not.toContain('Terminal · zsh');
  });

  it('indents the per-port rows and drops their status dot', async () => {
    await ready({ name: 'b-monitoring-busy' });
    const workspace = layer({ name: 'From workspace' });
    fireEvent.click(
      within(workspace).getByRole('button', { name: 'Show 9 ports of com.docker.backend' }),
    );
    const child = workspace.querySelector('[data-port-row="3306"]');

    expect(child?.querySelector('[role="status"]')).toBeNull();
    expect(child?.querySelector('.pl-8')).not.toBeNull();
  });
});
