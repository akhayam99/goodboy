// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26_SPAWNED_PANEL_SCENES } from './spawned-panel';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  document.documentElement.removeAttribute('data-theme');
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U26_SPAWNED_PANEL_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u26 Agents panel scenes', () => {
  it('registers every scene in both themes', () => {
    const names = Object.keys(U26_SPAWNED_PANEL_SCENES);
    expect(names.filter((name) => name.endsWith('-dark'))).toHaveLength(3);
    expect(names.filter((name) => name.endsWith('-light'))).toHaveLength(3);
    for (const [id, Scene] of Object.entries(U26_SPAWNED_PANEL_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each(['u26-spawned-auto-light', 'u26-spawned-auto-dark'])(
    '%s shows the Auto tree in the Agents panel',
    async (id) => {
      mount({ id });
      const panel = await screen.findByRole('region', { name: 'Agents' }, WAIT);
      const tree = within(panel).getByRole('tree', { name: 'Auto agents' });
      expect(within(tree).getAllByRole('treeitem')).toHaveLength(4);
    },
  );

  it.each(['u26-spawned-run-light', 'u26-spawned-run-dark'])(
    '%s shows the run tree in the Agents panel',
    async (id) => {
      mount({ id });
      const panel = await screen.findByRole('region', { name: 'Agents' }, WAIT);
      expect(within(panel).getByRole('tree', { name: 'Run agents' })).toBeDefined();
    },
  );

  it.each(['u26-spawned-transcript-light', 'u26-spawned-transcript-dark'])(
    '%s opens a child transcript with a way back to the tree',
    async (id) => {
      mount({ id });
      expect(
        await screen.findByPlaceholderText('Message Implementer', undefined, WAIT),
      ).toBeDefined();
      expect(screen.getByRole('button', { name: 'Back to agents' })).toBeDefined();
    },
  );
});
