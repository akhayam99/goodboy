// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { OrchestratedAutonomyMenu } from './OrchestratedAutonomyMenu';

const WORKSPACE = aWorkspace({ name: 'Northwind' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Ledger export' });
const RUN = aWorkflowRun({
  autoRun: true,
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
});

let useAppStore: StoryStore;

const setAutonomy = vi.fn(async () => undefined);

const openMenu = () => {
  render(<OrchestratedAutonomyMenu sessionId={SESSION.id} run={RUN} />);
  fireEvent.click(screen.getByRole('button', { name: 'Autonomy: Balanced' }));
  return screen.getByRole('menu', { name: 'Autonomy' });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  setAutonomy.mockClear();
  useAppStore.setState({ setWorkflowRunAutonomy: setAutonomy });
});

afterEach(cleanup);

describe('OrchestratedAutonomyMenu', () => {
  it('checks the current autonomy and describes each choice', () => {
    openMenu();

    const checked = screen
      .getAllByRole('menuitemradio')
      .filter((row) => row.getAttribute('aria-checked') === 'true')
      .map((row) => row.textContent);
    expect(checked).toEqual(['Balanced']);
    expect(
      screen.getByRole('menuitemradio', { name: 'Autopilot' }).getAttribute('aria-description'),
    ).toBe('Never pauses.');
  });

  it('moves through the choices with the arrow keys', () => {
    const menu = openMenu();

    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Ask me' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Balanced' }));
  });

  it('sets the chosen autonomy on the named run and closes', () => {
    openMenu();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Autopilot' }));

    expect(setAutonomy).toHaveBeenCalledWith(SESSION.id, RUN.id, 'run');
    expect(screen.queryByRole('menu', { name: 'Autonomy' })).toBeNull();
  });

  it('closes without a write when the current autonomy is chosen again', () => {
    openMenu();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Balanced' }));

    expect(setAutonomy).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu', { name: 'Autonomy' })).toBeNull();
  });
});
