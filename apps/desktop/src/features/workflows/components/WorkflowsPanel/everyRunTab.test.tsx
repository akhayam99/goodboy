// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_WORKFLOW_RULES, type Workspace } from '@goodboy/types';
import { aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WorkflowsPanel } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const renderPanel = () =>
  render(
    <ToastProvider>
      <WorkflowsPanel workspaceId={HARBORLINE.id} />
    </ToastProvider>,
  );

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Workflows, every run and saved steps' }));

const selectedTab = () =>
  tabs()
    .getAllByRole('tab')
    .filter((tab) => tab.getAttribute('aria-selected') === 'true')
    .map((tab) => tab.textContent);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ patch_workspace_overrides: null, db_select: () => [] });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    phaseTemplates: { [HARBORLINE.id]: [] },
    stepLibrary: { [HARBORLINE.id]: [] },
    loadPhaseTemplates: vi.fn(async () => undefined),
    loadStepLibrary: vi.fn(async () => undefined),
    loadSetting: vi.fn(async (): Promise<string | null> => null),
    loadWorkspaceValue: vi.fn(async (): Promise<string | null> => null),
    workspaceOverrides: {
      [HARBORLINE.id]: { ...EMPTY_OVERRIDES, workflowRules: DEFAULT_WORKFLOW_RULES },
    },
  });
});

afterEach(cleanup);

describe('the Every run tab', () => {
  it('sits between Workflows and Saved steps', () => {
    renderPanel();

    expect(
      tabs()
        .getAllByRole('tab')
        .map((tab) => tab.textContent?.replace(/\d+$/, '')),
    ).toEqual(['Workflows', 'Every run', 'Saved steps']);
    expect(selectedTab()).toEqual(['Workflows']);
  });

  it('opens from setWorkflowStudioView every and hands the request back', async () => {
    renderPanel();

    act(() => useAppStore.getState().setWorkflowStudioView('every'));

    expect(selectedTab()).toEqual(['Every run']);
    await screen.findByRole('region', { name: 'When a run stops for you' });
    screen.getByRole('region', { name: 'Roles' });
    expect(useAppStore.getState().workflowStudioView).toBe('workflows');
  });

  it('shows the run defaults when the tab is clicked and the list again on Workflows', async () => {
    renderPanel();

    fireEvent.click(tabs().getByRole('tab', { name: 'Every run' }));
    await screen.findByRole('region', { name: 'Spending' });

    fireEvent.click(tabs().getByRole('tab', { name: /^Workflows/ }));
    expect(screen.queryByRole('region', { name: 'Spending' })).toBeNull();
  });
});
