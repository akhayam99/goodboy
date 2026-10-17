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

const SCENE_FORM: Readonly<Record<SceneId, string>> = {
  'new-drawer-run': 'Run a workflow',
  'new-drawer-orchestrate': 'Run an orchestrator',
  'new-drawer-run-guidance': 'Run an orchestrator',
  'new-drawer-run-preset': 'Run a workflow',
  'new-drawer-run-preset-pin': 'Run a workflow',
  'new-drawer-agent': 'Start an agent',
  'new-drawer-agent-roles': 'Start an agent',
  'new-drawer-agent-auto': 'Start an auto',
  'new-drawer-write': 'Write a report',
  'new-drawer-write-wireframe': 'Draw a wireframe',
  'new-drawer-narrow': 'Run an orchestrator',
};

const SCENE_IDS: ReadonlyArray<SceneId> = [
  'new-drawer-run',
  'new-drawer-orchestrate',
  'new-drawer-run-guidance',
  'new-drawer-run-preset',
  'new-drawer-run-preset-pin',
  'new-drawer-agent',
  'new-drawer-agent-roles',
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

const drawer = async ({ id }: Params) =>
  within(await screen.findByRole('region', { name: SCENE_FORM[id] }));

describe('the New drawer scenes', () => {
  it('opens the Role list at its content width with every role name whole', async () => {
    show({ id: 'new-drawer-agent-roles' });

    const roles = await screen.findByRole('dialog', { name: 'Role' }, WAIT);
    expect(roles.style.width).toBe('');
    expect(within(roles).getByRole('button', { name: 'Implementer' }).textContent).toContain(
      'Implementer',
    );
  });

  it('registers every state', () => {
    for (const id of SCENE_IDS) {
      expect(MOCK_SCENES[id]).toBe(U24_NEW_DRAWER_SCENES[id]);
    }
  });

  it('opens Run an orchestrator with the goal, the orchestrator, the three pills and no likely steps', async () => {
    show({ id: 'new-drawer-orchestrate' });

    const inDrawer = await drawer({ id: 'new-drawer-orchestrate' });
    await waitFor(
      () =>
        expect(inDrawer.getByRole('textbox', { name: 'Goal' })).toHaveProperty(
          'value',
          'Stop retried webhooks posting a second credit, and let support see when a delivery retried',
        ),
      WAIT,
    );
    expect(inDrawer.queryByText('Likely steps')).toBeNull();
    expect(inDrawer.queryByRole('tablist', { name: 'What to start' })).toBeNull();
    expect(inDrawer.getByRole('button', { name: /^Autonomy: Balanced/ })).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Run an orchestrator' })).toBeDefined();
  });

  it('shows the guidance from the rules at once', async () => {
    show({ id: 'new-drawer-run-guidance' });

    const inDrawer = await drawer({ id: 'new-drawer-run-guidance' });
    expect(inDrawer.getByTestId('guidance-preview').textContent).toContain('ledger-core schema');
    const guidance = inDrawer.getByRole('region', { name: 'Guidance' });
    expect(within(guidance).getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('draws the preset steps with one model chip each', async () => {
    show({ id: 'new-drawer-run-preset' });

    const inDrawer = await drawer({ id: 'new-drawer-run-preset' });
    expect(inDrawer.getByRole('button', { name: 'Model for Scout the retry path' })).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Model for Build the guard' })).toBeDefined();
    expect(inDrawer.getByText('Waits for you to approve the plan')).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Run a workflow' })).toBeDefined();
  });

  it('hugs each step model in one line and shows the estimate row', async () => {
    show({ id: 'new-drawer-run-preset' });

    const inDrawer = await drawer({ id: 'new-drawer-run-preset' });
    const chip = await inDrawer.findByRole('button', { name: 'Model for Plan the guard' }, WAIT);
    expect(chip.querySelector('[data-routing-part="name"]')?.textContent).toBe('Opus 5.5');
    expect(chip.querySelector('[data-routing-part="detail"]')?.textContent).toBe('High');
    expect(chip.querySelector('[data-meta-column="model"]')?.className).not.toContain('w-34');
    expect(inDrawer.getByTestId('plan-estimate')).toBeDefined();
  });

  it('lists the connected providers when a step pins a model', async () => {
    show({ id: 'new-drawer-run-preset-pin' });

    expect(await screen.findByText('Provider', {}, WAIT)).toBeDefined();
    expect(screen.queryByText('No providers connected')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open providers' })).toBeNull();
  });

  it('opens Start an agent as one form: a goal, Role and Model', async () => {
    show({ id: 'new-drawer-agent' });

    const inDrawer = await drawer({ id: 'new-drawer-agent' });
    expect(inDrawer.getByRole('button', { name: 'Role: Generalist' })).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Start Generalist' })).toBeDefined();
    expect(inDrawer.getByRole('textbox', { name: 'Agent instructions' })).toBeDefined();
  });

  it('opens the Auto composer with one line about Auto', async () => {
    show({ id: 'new-drawer-agent-auto' });

    const inDrawer = await drawer({ id: 'new-drawer-agent-auto' });
    expect(
      inDrawer.getAllByText('Auto answers, or hands the work to the roles it picks.'),
    ).toHaveLength(1);
    expect(inDrawer.queryByText('It may not work well yet.')).toBeNull();
    expect(inDrawer.getByText('Experimental')).toBeDefined();
    expect(inDrawer.getByRole('button', { name: 'Start an auto' })).toBeDefined();
    expect(inDrawer.queryByText('Generalist')).toBeNull();
  });

  it('opens the report form with no format tabs', async () => {
    show({ id: 'new-drawer-write' });

    const inDrawer = await drawer({ id: 'new-drawer-write' });
    expect(inDrawer.getByTestId('artifact-brief')).toBeDefined();
    expect(inDrawer.queryByRole('tablist', { name: 'Write format' })).toBeNull();
  });

  it('opens the wireframe form', async () => {
    show({ id: 'new-drawer-write-wireframe' });

    const inDrawer = await drawer({ id: 'new-drawer-write-wireframe' });
    expect(inDrawer.queryByText('A wireframe drawn from this session.')).toBeNull();
  });

  it('stays an overlay at 1100 px', async () => {
    show({ id: 'new-drawer-narrow' });

    await drawer({ id: 'new-drawer-narrow' });
    expect(document.querySelector('[data-drawer-mode="overlay"]')).not.toBeNull();
    expect(document.querySelector('[data-drawer-scrim]')).not.toBeNull();
  });

  it.each(SCENE_IDS)('%s has no accessibility violations', async (id) => {
    const { container } = show({ id });
    await drawer({ id });
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
