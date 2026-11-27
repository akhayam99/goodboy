// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { BRING_HINTS } from '../../demo/hints/bringHints';
import { StoryBringScene } from './StoryBringScene';
import {
  readInboxFilters,
  writeInboxFilters,
} from '../../../../../features/inbox/kindFilterStorage';
import { BRAND_WORKSPACE_ID } from '../brand/canon';
import { demoRuns } from '../../demo/director/demoRunRegistry';
import { STORY_TASK_COUNT } from './storyTasks';

const OPEN_BUDGET = {
  remainingUsd: null,
  pct: 0,
  exceeded: false,
  overThreshold: false,
  spentUsd: 0,
  capUsd: null,
  thresholdPct: null,
  windowStartMs: 0,
  windowEndMs: 0,
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (command === 'check_provider_budget') {
      return Promise.resolve(OPEN_BUDGET);
    }
    if (command === 'worktree_remote_url') {
      return Promise.resolve(null);
    }
    return sceneInvoke({ command: String(command), args });
  });
  store.setState({ loadProjectGitStatus: async () => undefined });
});

afterEach(() => {
  demoRuns.cancelAll();
  cleanup();
  clearSceneInvoke();
});

const mount = async (): Promise<void> => {
  render(
    <ToastProvider>
      <StoryBringScene />
    </ToastProvider>,
  );
  await act(async () => undefined);
};

const labels = (): ReadonlyArray<string> =>
  screen.getAllByRole('option').map((row) => row.getAttribute('aria-label') ?? '');

type AnchorParams = {
  readonly selector: string;
};

const anchorOf = ({ selector }: AnchorParams): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`no ${selector}`);
  }
  return element;
};

const found = async ({ selector }: AnchorParams): Promise<HTMLElement> =>
  waitFor(() => anchorOf({ selector }), { timeout: 10000 });

type PressParams = AnchorParams & {
  readonly until?: string;
};

const press = async ({ selector, until }: PressParams): Promise<void> => {
  await waitFor(
    () => {
      if (until !== undefined && document.querySelector(until) !== null) {
        return;
      }
      const element = anchorOf({ selector });
      expect(element.hasAttribute('disabled')).toBe(false);
      fireEvent.click(element);
      if (until !== undefined) {
        throw new Error(`waiting for ${until}`);
      }
    },
    { timeout: 15000, interval: 350 },
  );
};

const WIZARD = '[aria-label="Goodboy setup"]';
const KEY_FIELD = '#linear-api-key';

const hasLinear = (): boolean =>
  Object.values(store.getState().workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

const walkToTheKeyField = async (): Promise<void> => {
  await mount();
  await press({ selector: '[data-step="agents"] [data-demo-anchor="setup-agent-signin"]' });
  await press({
    selector: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    until: '[data-step="workspace"] [data-demo-anchor="setup-create"]',
  });
  await press({
    selector: '[data-step="workspace"] [data-demo-anchor="setup-create"]',
    until: '[data-step="first-session"] [data-demo-anchor="setup-open-tools"]',
  });
  await press({
    selector: '[data-step="first-session"] [data-demo-anchor="setup-open-tools"]',
    until: '[data-step="tools"] button[aria-label="Connect Linear"]',
  });
  await press({
    selector: '[data-step="tools"] button[aria-label="Connect Linear"]',
    until: KEY_FIELD,
  });
};

const pasteTheKey = (): void => {
  const offer = BRING_HINTS.find((hint) => hint.id === 'bring-connect')?.offer;
  act(() => offer?.run({ root: document }));
};

describe('the bring your work scene', () => {
  it('opens the setup on the agents step with Codex waiting and no workspace yet', async () => {
    await mount();
    const dialog = await found({ selector: WIZARD });
    expect(dialog.getAttribute('data-step')).toBe('agents');
    await found({ selector: '[data-step="agents"] [data-demo-anchor="setup-agent-signin"]' });
    expect(store.getState().workspaces).toEqual([]);
    expect(hasLinear()).toBe(false);
    expect(document.querySelector('[role="option"]')).toBeNull();
  });

  it('creates Harborline from the three repositories the setup finds', async () => {
    await mount();
    await press({ selector: '[data-step="agents"] [data-demo-anchor="setup-agent-signin"]' });
    await press({
      selector: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
      until: '[data-step="workspace"] [data-demo-anchor="setup-create"]',
    });
    await press({
      selector: '[data-step="workspace"] [data-demo-anchor="setup-create"]',
      until: '[data-step="first-session"] [data-demo-anchor="setup-open-tools"]',
    });
    expect(store.getState().workspaces.map((workspace) => workspace.name)).toEqual(['Harborline']);
    const names = store.getState().projects.map((project) => project.name);
    expect(Array.from(new Set(names))).toEqual(['payments-api', 'ledger-core', 'notify-relay']);
  }, 40000);

  it('connects Linear inside the setup through the real check once the example key is in', async () => {
    await walkToTheKeyField();
    expect(hasLinear()).toBe(false);
    pasteTheKey();
    await waitFor(() => expect(hasLinear()).toBe(true), { timeout: 12000 });
    const binding = Object.values(store.getState().workspaceIntegrations)
      .flat()
      .find((entry) => entry.provider === 'linear');
    expect(binding?.config).toMatchObject({
      workspaceUrlKey: 'harborline',
      viewerName: 'Dana R.',
    });
    expect(anchorOf({ selector: WIZARD }).getAttribute('data-step')).toBe('tools');
  }, 60000);

  it('refuses any other key with the real error', async () => {
    await walkToTheKeyField();
    fireEvent.change(anchorOf({ selector: KEY_FIELD }), {
      target: { value: 'lin_api_not_the_example_key' },
    });
    expect(await screen.findByRole('alert', {}, { timeout: 12000 })).toBeDefined();
    expect(hasLinear()).toBe(false);
  }, 60000);

  it('lands on Tasks with every source and no agent started when Continue is pressed', async () => {
    const workspaceId = BRAND_WORKSPACE_ID;
    writeInboxFilters({ workspaceId, kind: 'thread', source: 'slack' });
    await walkToTheKeyField();
    pasteTheKey();
    await waitFor(() => expect(hasLinear()).toBe(true), { timeout: 12000 });
    expect(document.querySelector('[role="option"]')).toBeNull();
    await press({ selector: '[data-step="tools"] [data-demo-anchor="setup-continue"]' });
    await waitFor(() => expect(labels()).toHaveLength(STORY_TASK_COUNT), { timeout: 20000 });
    await waitFor(() => expect(document.querySelector(WIZARD)).toBeNull(), { timeout: 10000 });
    expect(labels()[0]).toContain('HBL-412 Retried webhooks post a second credit, Todo, Urgent');
    expect(labels().filter((label) => label.startsWith('HBL-'))).toHaveLength(3);
    expect(screen.getAllByRole('img', { name: 'New' })).toHaveLength(2);
    expect(store.getState().currentWorkspaceId).toBe(workspaceId);
    expect(store.getState().sessions).toEqual([]);
    expect(store.getState().currentSessionId).toBeNull();
    const providers = Object.values(store.getState().workspaceIntegrations)
      .flat()
      .map((binding) => binding.provider);
    expect(providers).toEqual(expect.arrayContaining(['gitlab', 'sentry', 'slack', 'linear']));
    expect(readInboxFilters({ workspaceId })).toEqual({ kind: 'all', source: null });
  }, 90000);

  it('lands on Tasks when the visitor leaves the setup with Set up later', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Set up later' }));
    await waitFor(() => expect(labels()).toHaveLength(STORY_TASK_COUNT), { timeout: 20000 });
    await waitFor(() => expect(document.querySelector(WIZARD)).toBeNull(), { timeout: 10000 });
    expect(store.getState().sessions).toEqual([]);
  }, 60000);

  it('never shows acme-web or Cascadia', async () => {
    await mount();
    await found({ selector: WIZARD });
    const text = (document.body.textContent ?? '').toLowerCase();
    expect(text).not.toContain('acme-web');
    expect(text).not.toContain('cascadia');
  });
});
