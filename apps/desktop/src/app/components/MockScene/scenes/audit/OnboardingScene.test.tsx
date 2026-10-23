// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { useAppStore } from '../../../../../store';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { OnboardingScene } from './OnboardingScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type MountParams = {
  readonly query: string;
};

const mount = async ({ query }: MountParams): Promise<void> => {
  window.history.replaceState(null, '', `/?scene=onboarding${query}`);
  render(<OnboardingScene />);
  await act(async () => undefined);
};

const shownStep = (): string | null =>
  screen.queryByRole('dialog', { name: 'Goodboy setup' })?.getAttribute('data-step') ?? null;

const SCENE_OPEN_MS = 150;

type ButtonParams = {
  readonly name: string | RegExp;
};

const enabledButton = async ({ name }: ButtonParams): Promise<HTMLElement> =>
  waitFor(() => {
    const button = screen.getByRole('button', { name });
    expect(button.hasAttribute('disabled')).toBe(false);
    return button;
  });

const workspaceNames = (): ReadonlyArray<string> =>
  useAppStore.getState().workspaces.map((workspace) => workspace.name);

describe('onboarding scene', () => {
  it('opens on the step its id names, with no workspace before one is made', async () => {
    await mount({ query: '&step=agents' });

    await waitFor(() => expect(shownStep()).toBe('agents'));
    expect(workspaceNames()).toEqual([]);
  });

  it('takes a workspace state by name for the steps after Workspace', async () => {
    await mount({ query: '&step=tools&ws=folder' });

    await waitFor(() => expect(shownStep()).toBe('tools'));
    expect(workspaceNames()).toEqual(['Acme docs']);
  });

  it('seeds the agents state it names', async () => {
    await mount({ query: '&step=agents&agents=none' });

    const connected = useAppStore
      .getState()
      .providers.filter((provider) => provider.connection === 'connected');
    expect(connected).toEqual([]);
  });

  it('connects Linear with a mock account and asks for no key', async () => {
    await mount({ query: '&step=tools' });
    await act(() => new Promise((resolve) => setTimeout(resolve, SCENE_OPEN_MS)));
    expect(shownStep()).toBe('tools');

    fireEvent.click(await enabledButton({ name: 'Connect Linear' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Connect Linear' })).toBeNull(),
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    const state = useAppStore.getState();
    const workspaceId = state.currentWorkspaceId;
    expect(
      (workspaceId === null ? [] : (state.workspaceIntegrations[workspaceId] ?? [])).map(
        (binding) => binding.provider,
      ),
    ).toEqual(['linear']);
  });

  it('falls back to Welcome on an old numbered step', async () => {
    await mount({ query: '&step=1' });

    await waitFor(() => expect(shownStep()).toBe('welcome'));
  });

  it('walks from the folder pick to a running first session with no native call', async () => {
    await mount({ query: '&step=workspace' });
    await act(() => new Promise((resolve) => setTimeout(resolve, SCENE_OPEN_MS)));
    expect(shownStep()).toBe('workspace');

    fireEvent.click(await enabledButton({ name: /Choose folder/ }));
    fireEvent.click(await enabledButton({ name: /Create workspace/ }));

    await waitFor(() => expect(shownStep()).toBe('tools'));
    expect(workspaceNames()).toEqual(['Harborline']);
    const state = useAppStore.getState();
    expect(
      state.projects
        .filter((project) => project.workspaceId === state.currentWorkspaceId)
        .map((project) => project.name),
    ).toEqual(['payments-api', 'ledger-core', 'notify-relay']);

    fireEvent.click(await enabledButton({ name: /Continue/ }));
    await waitFor(() => expect(shownStep()).toBe('first-session'));

    fireEvent.click(await enabledButton({ name: 'Find one small bug' }));
    fireEvent.click(await enabledButton({ name: /^Start/ }));

    await waitFor(() => expect(shownStep()).toBeNull());
    expect(screen.queryByText(/not found/)).toBeNull();
    await screen.findByRole('textbox', { name: 'Message to the agent' });
    const session = useAppStore.getState().currentSessionId;
    const agent = session === null ? null : useAppStore.getState().selectedAgentId[session];
    const events =
      agent === null || agent === undefined ? [] : useAppStore.getState().transcripts[agent];
    expect(events?.[0]).toMatchObject({
      kind: 'user_text',
      text: 'Find one small, real bug in payments-api. Say where it is and why it is a bug. Do not change any file.',
    });
    await waitFor(
      () =>
        expect(
          (agent === null || agent === undefined
            ? []
            : (useAppStore.getState().transcripts[agent] ?? [])
          ).some((event) => event.kind === 'assistant_text'),
        ).toBe(true),
      { timeout: 4000 },
    );
  }, 20000);
});
