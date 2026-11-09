// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { useAppStore } from '../../../../../store';
import { selectWorkspaceKindRouting } from '../../../../../store/slices/agents/selectWorkspaceKindRouting';
import { DEFAULT_PERMISSION_MODE } from '../../../../../features/permissions/modeCopy';
import { createHintEngine, type HintEngine } from '../../demo/director/createHintEngine';
import type { DemoHintReport } from '../../demo/director/demoProtocol';
import { BRING_HINTS } from '../../demo/hints/bringHints';
import { ToastProvider } from '../../../../../shared/components/Toast';
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
  render(
    <ToastProvider>
      <OnboardingScene />
    </ToastProvider>,
  );
  await act(async () => undefined);
};

const shownStep = (): string | null =>
  screen.queryByRole('dialog', { name: 'Goodboy setup' })?.getAttribute('data-step') ?? null;

const SCENE_OPEN_MS = 150;

const mountOpen = async ({ query }: MountParams): Promise<void> => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    await mount({ query });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCENE_OPEN_MS);
    });
  } finally {
    vi.useRealTimers();
  }
};

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

    await waitFor(() => expect(shownStep()).toBe('tools'), { timeout: 5000 });
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
    await mountOpen({ query: '&step=tools' });
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

  it('falls back to Agents on an old numbered step', async () => {
    await mount({ query: '&step=1' });

    await waitFor(() => expect(shownStep()).toBe('agents'));
  });

  it('walks from the folder pick to a running first session with no native call', async () => {
    await mountOpen({ query: '&step=workspace' });
    expect(shownStep()).toBe('workspace');

    fireEvent.click(await enabledButton({ name: /Choose folder/ }));
    fireEvent.click(await enabledButton({ name: /Create workspace/ }));

    await waitFor(() => expect(shownStep()).toBe('first-session'), { timeout: 5000 });
    expect(workspaceNames()).toEqual(['Harborline']);
    const state = useAppStore.getState();
    expect(
      state.projects
        .filter((project) => project.workspaceId === state.currentWorkspaceId)
        .map((project) => project.name),
    ).toEqual(['payments-api', 'ledger-core', 'notify-relay']);

    fireEvent.click(await enabledButton({ name: 'Find one small bug' }));
    const demoAnchor = '[data-step="first-session"] [data-demo-anchor="setup-first-start"]';
    expect(document.querySelector(demoAnchor)?.textContent).toContain('Start');
    fireEvent.click(await enabledButton({ name: /^Start/ }));

    await waitFor(() => expect(shownStep()).toBeNull(), { timeout: 5000 });
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

  it('answers with no GitHub only when the scene is told so', async () => {
    await mount({ query: '&step=agents' });
    expect(useAppStore.getState().githubStatus?.available).toBe(true);
    cleanup();
    await resetStoryStore();

    await mount({ query: '&step=agents&github=none' });
    expect(useAppStore.getState().githubStatus).toBeNull();
  });

  it('starts the sample scout on the model and edit mode the composer showed', async () => {
    await mountOpen({ query: '&step=workspace' });
    fireEvent.click(await enabledButton({ name: /Choose folder/ }));
    fireEvent.click(await enabledButton({ name: /Create workspace/ }));
    await waitFor(() => expect(shownStep()).toBe('first-session'), { timeout: 5000 });
    const state = useAppStore.getState();
    const workspaceId = state.currentWorkspaceId;
    if (workspaceId === null) {
      throw new Error('no workspace');
    }
    const shown = selectWorkspaceKindRouting({ state, workspaceId, kind: 'scout' });
    const draftMode = state.sessionDrafts[workspaceId]?.permissionMode ?? DEFAULT_PERMISSION_MODE;

    fireEvent.click(await enabledButton({ name: /^Start/ }));

    await waitFor(() => expect(shownStep()).toBeNull(), { timeout: 5000 });
    const after = useAppStore.getState();
    const sessionId = after.currentSessionId;
    const agentId = sessionId === null ? undefined : after.selectedAgentId[sessionId];
    const events = agentId === undefined || agentId === null ? [] : after.transcripts[agentId];
    expect(events?.[0]).toMatchObject({
      kind: 'user_text',
      provider: shown.provider,
      model: shown.model,
    });
    expect(after.sessions.find((session) => session.id === sessionId)?.permissionMode).toBe(
      draftMode,
    );
  }, 20000);

  it('tells the visitor setup stays open when Skip closes it in the directed scene', async () => {
    await mount({ query: '&step=first-session&ws=repo&director=1' });
    await waitFor(() => expect(shownStep()).toBe('first-session'), { timeout: 5000 });
    await enabledButton({ name: 'Draft the brief' });

    fireEvent.click(await enabledButton({ name: 'Skip' }));

    await waitFor(() => expect(shownStep()).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(shownStep()).toBe('first-session'), { timeout: 4000 });
    const messages = useAppStore.getState().undoNotices.map((notice) => notice.toast.message);
    expect(messages).toEqual(['Setup stays open in the demo.']);
  }, 20000);
});

type ClickParams = {
  readonly element: Element;
};

const visitorClick = async ({ element }: ClickParams): Promise<boolean> => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  await act(async () => {
    element.dispatchEvent(event);
  });
  return event.defaultPrevented;
};

const engines: Array<HintEngine> = [];

afterEach(() => {
  for (const engine of engines.splice(0)) {
    engine.dispose();
  }
});

const startBringEngine = () => {
  const reports: Array<DemoHintReport> = [];
  const engine = createHintEngine({
    store: useAppStore,
    view: window,
    generation: () => 0,
    hintsOf: () => BRING_HINTS,
    onReport: ({ report }) => reports.push(report),
  });
  engines.push(engine);
  engine.setTrack({ chapterId: 'bring', settledIds: [], isGuarding: true });
  return {
    tried: (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : [])),
    blocked: (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'blocked' ? [report.hintId] : [])),
  };
};

describe('chapter 1 hints on the onboarding scene', () => {
  it('walks sign in, continue, create, connect Linear and the issue list', async () => {
    await mount({ query: '&step=agents&pick=folder&github=none&director=1' });
    await waitFor(() => expect(shownStep()).toBe('agents'), { timeout: 5000 });
    const { tried, blocked } = startBringEngine();
    expect(BRING_HINTS).toHaveLength(6);

    expect(await visitorClick({ element: await enabledButton({ name: 'Check now' }) })).toBe(true);
    expect(blocked()).toEqual(['setup-agent-signin']);
    await visitorClick({ element: await enabledButton({ name: /Sign in to Codex/ }) });
    await waitFor(() => expect(tried()).toEqual(['setup-agent-signin']), { timeout: 4000 });

    await visitorClick({ element: await enabledButton({ name: /^Continue/ }) });
    await waitFor(() => expect(tried()).toContain('setup-agents'), { timeout: 4000 });
    await waitFor(() => expect(shownStep()).toBe('workspace'), { timeout: 5000 });

    await visitorClick({ element: await enabledButton({ name: /Create workspace/ }) });
    await waitFor(() => expect(tried()).toContain('setup-create'), { timeout: 5000 });
    await waitFor(() => expect(shownStep()).toBe('first-session'), { timeout: 5000 });

    const openTools = await screen.findByRole('button', { name: 'Connect Linear or Jira' });
    expect(await visitorClick({ element: await enabledButton({ name: /^Start/ }) })).toBe(true);
    expect(await visitorClick({ element: await enabledButton({ name: 'Skip' }) })).toBe(true);
    expect(shownStep()).toBe('first-session');
    expect(blocked().length).toBeGreaterThan(0);

    await visitorClick({ element: openTools });
    await waitFor(() => expect(shownStep()).toBe('tools'), { timeout: 5000 });
    await waitFor(() => expect(tried()).toContain('setup-open-tools'), { timeout: 4000 });

    await visitorClick({ element: await enabledButton({ name: 'Connect Linear' }) });
    await waitFor(() => expect(tried()).toContain('setup-linear'), { timeout: 4000 });

    await visitorClick({ element: await enabledButton({ name: /^Continue/ }) });
    await waitFor(() => expect(shownStep()).toBe('first-session'), { timeout: 5000 });
    await waitFor(() => expect(tried()).toEqual(BRING_HINTS.map((hint) => hint.id)), {
      timeout: 4000,
    });

    const issues = await screen.findByRole('list', { name: 'Issues' });
    expect(
      within(issues)
        .getAllByText(/^HBL-/)
        .map((node) => node.textContent),
    ).toEqual(['HBL-412', 'HBL-409', 'HBL-397']);
    expect(
      within(issues).getByText('HBL-412').closest('[aria-pressed]')?.getAttribute('aria-pressed'),
    ).toBe('true');
  }, 40000);
});
