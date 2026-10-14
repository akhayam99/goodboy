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
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_NEW_DRAWER_SCENES } from './new-drawer';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const WAIT = { timeout: 4_000 };

type SceneId = keyof typeof U24_NEW_DRAWER_SCENES;

type Params = { readonly id: SceneId };

const SCENE_IDS: ReadonlyArray<SceneId> = [
  'new-drawer-run',
  'new-drawer-run-guidance',
  'new-drawer-run-preset',
  'new-drawer-agent',
  'new-drawer-agent-auto',
  'new-drawer-write',
  'new-drawer-write-wireframe',
  'new-drawer-narrow',
];

const show = ({ id }: Params) => {
  const Scene = U24_NEW_DRAWER_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const drawer = async () => within(await screen.findByRole('region', { name: 'New' }));

describe('the New drawer scenes', () => {
  it('registers every state', () => {
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_NEW_DRAWER_SCENES[id]);
    }
  });

  it('opens on Orchestrate with the goal, the likely steps and the three pills', async () => {
    show({ id: 'new-drawer-run' });

    const inDrawer = await drawer();
    expect(inDrawer.getByRole('tab', { name: 'Run' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(
      () =>
        expect(inDrawer.getByRole('textbox', { name: 'Goal' })).toHaveProperty(
          'value',
          'Stop retried webhooks posting a second credit, and let support see when a delivery retried',
        ),
      WAIT,
    );
    expect(inDrawer.getByText('Likely steps')).toBeDefined();
    expect(inDrawer.getByText('Waits for you to approve the plan')).toBeDefined();
    expect(inDrawer.getByRole('button', { name: /^Autonomy: Balanced/ })).toBeDefined();
    expect(inDrawer.getByRole('button', { name: /start run/i })).toBeDefined();
  });

  it('shows the guidance from the rules at once', async () => {
    show({ id: 'new-drawer-run-guidance' });

    const inDrawer = await drawer();
    expect(inDrawer.getByTestId('guidance-preview').textContent).toContain('ledger-core schema');
    const guidance = inDrawer.getByRole('region', { name: 'Guidance' });
    expect(within(guidance).getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('draws the preset steps with one model chip each', async () => {
    show({ id: 'new-drawer-run-preset' });

    const inDrawer = await drawer();
    expect(inDrawer.getByRole('button', { name: 'Model for Scout the retry path' })).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Model for Build the guard' })).toBeDefined();
    expect(inDrawer.getByText('Waits for you to approve the plan')).toBeDefined();
  });

  it('opens on Agent with the roles of today and no message field', async () => {
    show({ id: 'new-drawer-agent' });

    const inDrawer = await drawer();
    expect(inDrawer.getByRole('tab', { name: 'Agent' }).getAttribute('aria-selected')).toBe('true');
    expect(inDrawer.getByText('Generalist')).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Open Generalist' })).toBeDefined();
    expect(inDrawer.queryByRole('textbox')).toBeNull();
  });

  it('opens the Auto composer with the experimental note', async () => {
    show({ id: 'new-drawer-agent-auto' });

    const inDrawer = await drawer();
    expect(inDrawer.getByText('It may not work well yet.')).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Start Auto' })).toBeDefined();
    expect(inDrawer.queryByText('Generalist')).toBeNull();
  });

  it('opens on Write with Report and Wireframe', async () => {
    show({ id: 'new-drawer-write' });

    const inDrawer = await drawer();
    expect(inDrawer.getByRole('tab', { name: 'Report' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(inDrawer.getByRole('tab', { name: 'Wireframe' })).toBeDefined();
  });

  it('opens the wireframe fields', async () => {
    show({ id: 'new-drawer-write-wireframe' });

    const inDrawer = await drawer();
    expect(inDrawer.getByRole('tab', { name: 'Wireframe' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('stays an overlay at 1100 px', async () => {
    show({ id: 'new-drawer-narrow' });

    await drawer();
    expect(document.querySelector('[data-drawer-mode="overlay"]')).not.toBeNull();
    expect(document.querySelector('[data-drawer-scrim]')).not.toBeNull();
  });

  it.each(SCENE_IDS)('%s has no accessibility violations', async (id) => {
    const { container } = show({ id });
    await screen.findByRole('region', { name: 'New' });
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
