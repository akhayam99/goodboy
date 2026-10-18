// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26S_MONITORING_SCENES } from './MonitoringRowsScene';

const WAIT = { timeout: 15_000 };

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
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_MONITORING_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U26S_MONITORING_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const portRow = (port: number): HTMLElement => {
  const row = document.querySelector(`[data-port-row="${port}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no row for :${port}`);
  }
  return row;
};

describe('the secondary Monitoring scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_MONITORING_SCENES).sort()).toEqual([
      'u26s-monitoring-confirm',
      'u26s-monitoring-empty',
      'u26s-monitoring-hover',
      'u26s-monitoring-menu',
      'u26s-monitoring-rows',
    ]);
    expect(MOCK_SCENES['u26s-monitoring-rows']).toBe(
      U26S_MONITORING_SCENES['u26s-monitoring-rows'],
    );
  });

  it('u26s-monitoring-rows names each group with its count and free ports', async () => {
    mount({ id: 'u26s-monitoring-rows' });

    await waitFor(
      () => expect(document.querySelector('[data-port-row="5005"]')).not.toBeNull(),
      WAIT,
    );
    const pinned = screen.getByRole('region', { name: 'Pinned' });

    expect(within(pinned).getByRole('button', { name: '1 free: :9000' })).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Run by Goodboy' })).getByText('no port'),
    ).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'From workspace' })).getByRole('button', {
        name: /^5 free: /,
      }),
    ).toBeDefined();
  });

  it('u26s-monitoring-menu opens the registry menu of :4001', async () => {
    mount({ id: 'u26s-monitoring-menu' });

    const menu = await screen.findByRole('menu', { name: 'Actions for :4001' }, WAIT);

    expect(within(menu).getByRole('menuitem', { name: 'Stop' })).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: 'Copy address' })).toBeDefined();
  });

  it('u26s-monitoring-confirm asks before stopping vite and names the port', async () => {
    mount({ id: 'u26s-monitoring-confirm' });

    const dialog = await screen.findByRole('dialog', { name: 'Stop vite on :3000?' }, WAIT);

    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(portRow(3000).contains(dialog)).toBe(false);
  });

  it('u26s-monitoring-empty teaches what fills the page', async () => {
    mount({ id: 'u26s-monitoring-empty' });

    expect(await screen.findByRole('heading', { name: 'No ports in use' }, WAIT)).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Pin a port' })).toHaveLength(1);
  });
});
