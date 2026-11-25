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
import { installStoryDirection } from '../../demo/director/installStoryDirection';
import { STORY_QUESTION } from './storyContent';
import { STORY_EXAMPLE_KEY } from './storyTasks';
import { STORY_SESSION_ID } from './storyWorld';

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
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    command === 'check_provider_budget'
      ? Promise.resolve(OPEN_BUDGET)
      : sceneInvoke({ command: String(command), args }),
  );
  store.setState({ loadProjectGitStatus: async () => undefined });
});

afterEach(() => {
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
  readonly name: string;
};

const anchorOf = ({ name }: AnchorParams): Element => {
  const element = document.querySelector(`[data-demo-anchor="${name}"]`);
  if (element === null) {
    throw new Error(`no ${name}`);
  }
  return element;
};

const hasLinear = (): boolean =>
  Object.values(store.getState().workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

describe('the bring your work scene', () => {
  it('lands on the Linear connection page of Harborline with the other tools connected', async () => {
    await mount();
    const field = await screen.findByLabelText('API key', {}, { timeout: 5000 });
    expect(field.getAttribute('id')).toBe('linear-api-key');
    expect(hasLinear()).toBe(false);
    const providers = Object.values(store.getState().workspaceIntegrations)
      .flat()
      .map((binding) => binding.provider)
      .sort();
    expect(providers).toEqual(['gitlab', 'sentry', 'slack']);
    const names = store.getState().projects.map((project) => project.name);
    expect(names).toEqual(['payments-api', 'ledger-core', 'notify-relay']);
  });

  it('connects Linear through the real check once the example key is pasted', async () => {
    await mount();
    await screen.findByLabelText('API key', {}, { timeout: 5000 });
    act(() => BRING_HINTS[0]?.offer?.run({ root: document }));
    expect(screen.getByLabelText('API key')).toHaveProperty('value', STORY_EXAMPLE_KEY);
    await waitFor(() => expect(hasLinear()).toBe(true), { timeout: 8000 });
    const binding = Object.values(store.getState().workspaceIntegrations)
      .flat()
      .find((entry) => entry.provider === 'linear');
    expect(binding?.config).toMatchObject({
      workspaceUrlKey: 'harborline',
      viewerName: 'Dana R.',
    });
  }, 20000);

  it('refuses any other key with the real error', async () => {
    await mount();
    const field = await screen.findByLabelText('API key', {}, { timeout: 5000 });
    fireEvent.change(field, { target: { value: 'lin_api_not_the_example_key' } });
    expect(await screen.findByRole('alert', {}, { timeout: 8000 })).toBeDefined();
    expect(hasLinear()).toBe(false);
  }, 20000);

  it('opens Tasks from the page menu with five sources and eleven items', async () => {
    await mount();
    await screen.findByLabelText('API key', {}, { timeout: 5000 });
    act(() => BRING_HINTS[0]?.offer?.run({ root: document }));
    await waitFor(() => expect(hasLinear()).toBe(true), { timeout: 8000 });
    fireEvent.click(await screen.findByRole('button', { name: 'More Linear actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Open in Tasks/ }));
    await waitFor(() => expect(labels()).toHaveLength(11), { timeout: 8000 });
    expect(labels()[0]).toContain('HBL-412 Retried webhooks post a second credit, Todo, Urgent');
    expect(labels().filter((label) => label.startsWith('HBL-'))).toHaveLength(3);
    expect(screen.getAllByRole('img', { name: 'New' })).toHaveLength(2);
    expect(labels().some((label) => label.includes('acme-web'))).toBe(false);
  }, 40000);

  it('hands HBL-412 from its pane to a new session and starts it', async () => {
    await mount();
    await screen.findByLabelText('API key', {}, { timeout: 5000 });
    act(() => BRING_HINTS[0]?.offer?.run({ root: document }));
    await waitFor(() => expect(hasLinear()).toBe(true), { timeout: 8000 });
    fireEvent.click(await screen.findByRole('button', { name: 'More Linear actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Open in Tasks/ }));
    await waitFor(() => expect(labels()).toHaveLength(11), { timeout: 8000 });
    installStoryDirection({ store: store });
    fireEvent.click(screen.getByRole('option', { name: /^HBL-412 / }));
    fireEvent.click(await waitFor(() => anchorOf({ name: 'task-start' }), { timeout: 8000 }));
    const start = await waitFor(() => anchorOf({ name: 'draft-start' }), { timeout: 8000 });
    expect(document.body.textContent).toContain('[HBL-412] Retried webhooks post a second credit');
    fireEvent.click(start);
    await waitFor(() => expect(store.getState().currentSessionId).toBe(STORY_SESSION_ID), {
      timeout: 8000,
    });
    expect(
      (store.getState().sessionExternalTasks[STORY_SESSION_ID] ?? []).map(
        (task) => task.identifier,
      ),
    ).toEqual(['HBL-412']);
    expect(await screen.findByText(STORY_QUESTION.text, {}, { timeout: 8000 })).toBeDefined();
  }, 60000);

  it('never shows acme-web or Cascadia', async () => {
    await mount();
    await screen.findByLabelText('API key', {}, { timeout: 5000 });
    const text = (document.body.textContent ?? '').toLowerCase();
    expect(text).not.toContain('acme-web');
    expect(text).not.toContain('cascadia');
  });
});
