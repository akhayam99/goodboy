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

type TabsParams = {
  readonly name: string;
};

const tabLabels = async ({ name }: TabsParams): Promise<ReadonlyArray<string>> => {
  const list = await screen.findByRole('tablist', { name }, WAIT);
  return within(list)
    .getAllByRole('tab')
    .map((tab) => tab.textContent ?? '');
};

describe('the u27 start page scenes', () => {
  it('registers every before and after scene', () => {
    for (const [id, Scene] of Object.entries(U27_START_PAGE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
    expect(Object.keys(U27_START_PAGE_SCENES)).toHaveLength(10);
  });

  it('shows the two ways to start that the owner saw in 0.27.10', async () => {
    mount({ id: 'u27-start-page-before-0-27-10' });

    expect(await screen.findByRole('region', { name: 'Start a run' }, WAIT)).toBeDefined();
    const labels = await tabLabels({ name: 'How do you want to start?' });
    expect(labels).toEqual([
      'Pick up a task',
      'Run a workflow',
      'Run an orchestrator',
      'Start an agent',
    ]);
  });

  it('opens on two explained cards and walks Workflow to its two kinds', async () => {
    mount({ id: 'u27-start-page-after-choice' });

    const kinds = await screen.findByRole('tablist', { name: 'What kind of run?' }, WAIT);
    const cards = within(kinds).getAllByRole('tab');
    expect(cards.map((card) => card.textContent?.split('Example')[0])).toEqual([
      'WorkflowSteps you can see and steer, one agent on each.',
      'AgentOne agent works on it in one conversation.',
    ]);
    expect(
      screen.getByRole('button', { name: /Not sure\? Describe it and Auto picks/ }),
    ).toBeDefined();

    fireEvent.click(within(kinds).getByRole('tab', { name: /^Workflow/ }));
    const shapes = await tabLabels({ name: 'Which workflow?' });
    expect(shapes.map((label) => label.split('Auto')[0]?.split('A saved')[0])).toEqual([
      'Orchestrated',
      'Preset',
    ]);
  });

  it('gives the agent form a role and a model and no limit', async () => {
    mount({ id: 'u27-start-page-after-agent-form' });

    const form = await screen.findByRole('region', { name: 'Agent form' }, WAIT);
    expect(within(form).getByRole('combobox', { name: 'Role' }).textContent).toContain('Scout');
    expect(within(form).getByRole('button', { name: /^Model: / })).toBeDefined();
    expect(within(form).queryByText(/Limit/)).toBeNull();
    expect(within(form).getByRole('button', { name: 'Start Scout' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Start a run' })).toBeNull();
  });

  it('shows the preset with its steps, Follow it or Adapt as it goes, and the task attached', async () => {
    mount({ id: 'u27-start-page-after-preset-form' });

    const form = await screen.findByRole('region', { name: 'Preset form' }, WAIT);
    expect(within(form).getByRole('combobox', { name: 'Preset' }).textContent).toContain(
      'Fix a layout',
    );
    expect(
      within(within(form).getByRole('list', { name: 'Preset steps' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(within(form).getByRole('tablist', { name: 'With the preset' })).toBeDefined();
    expect(screen.getByText('Member pages drift left on wide screens')).toBeDefined();
    expect(within(form).getByRole('button', { name: 'Start workflow' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Where' }).textContent).toContain('harbor-portal');
    fireEvent.click(screen.getByRole('button', { name: 'Remove HBR-142' }));
    expect(await screen.findByRole('combobox', { name: 'Pick from Tasks' }, WAIT)).toBeDefined();
  });

  it('keeps Auto picks as the one field behind the fallback, with a way back', async () => {
    mount({ id: 'u27-start-page-after-auto-picks' });

    expect(await screen.findByRole('region', { name: 'Start a run' }, WAIT)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pick it yourself' }));
    expect(await screen.findByRole('tablist', { name: 'What kind of run?' }, WAIT)).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Start a run' })).toBeNull();
  });
});
