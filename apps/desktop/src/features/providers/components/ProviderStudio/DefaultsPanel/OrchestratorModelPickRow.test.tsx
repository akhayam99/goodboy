// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EMPTY_OVERRIDES, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { OrchestratorModelPickRow } from './OrchestratorModelPickRow';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

let useAppStore: StoryStore;

const toggle = () =>
  screen.getByRole('switch', { name: 'Let the workflow orchestrator choose models' });

const savedRule = () =>
  useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules?.canOrchestratorPickModel;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    workspaceOverrides: { [WORKSPACE.id]: { ...EMPTY_OVERRIDES } },
  });
});

afterEach(cleanup);

describe('OrchestratorModelPickRow', () => {
  it('ships off and says Goodboy picks the model from the difficulty', () => {
    render(<OrchestratorModelPickRow workspaceId={WORKSPACE.id} />);

    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/Goodboy picks the model on your provider order/)).not.toBeNull();
  });

  it('saves the rule on the workspace and says the orchestrator names the model once on', async () => {
    render(<OrchestratorModelPickRow workspaceId={WORKSPACE.id} />);

    fireEvent.click(toggle());

    await waitFor(() => expect(savedRule()).toBe(true));
    await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByText(/also names the provider, model and effort/)).not.toBeNull();
  });

  it('turns the rule off again', async () => {
    render(<OrchestratorModelPickRow workspaceId={WORKSPACE.id} />);
    fireEvent.click(toggle());
    await waitFor(() => expect(savedRule()).toBe(true));

    fireEvent.click(toggle());

    await waitFor(() => expect(savedRule()).toBe(false));
  });
});
