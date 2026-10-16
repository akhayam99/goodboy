// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_C06_CONVERSATION_SCENES } from './c06-conversation';
import { C06_AGENT_ID, C06_SESSION_ID } from './c06ConversationSeed';

const SETTLE_MS = 1_500;

type SceneName = keyof typeof U25_C06_CONVERSATION_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U25_C06_CONVERSATION_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const titleRow = () => screen.getByTestId('agent-header-title-row');

describe('the c06 conversation scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [name, Scene] of Object.entries(U25_C06_CONVERSATION_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
  });

  it('c06-agent-working keeps one header row with role, title and provider, and no tabs, state or model', async () => {
    await mount({ name: 'c06-agent-working' });

    const row = titleRow();
    expect(within(row).getByText('Reinstall dependencies in payments-api')).toBeDefined();
    expect(within(row).getByTestId('agent-header-provider').textContent).toContain('Claude');
    expect(within(row).getByRole('button', { name: 'View transcript' })).toBeDefined();
    expect(within(row).getByRole('button', { name: 'More agent actions' })).toBeDefined();
    expect(within(row).queryByText('Running')).toBeNull();
    expect(within(row).queryByText('Opus 5')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('c06-agent-working says turn one in one line, hides narration and shows the plan once', async () => {
    await mount({ name: 'c06-agent-working' });

    expect(screen.getByRole('button', { name: 'Read package.json, ran a command' })).toBeDefined();
    expect(screen.queryByText('Checking the lockfiles first.')).toBeNull();
    expect(screen.queryByText('Installing now.')).toBeNull();
    const plans = screen.getAllByRole('region', { name: 'Plan' });
    expect(plans).toHaveLength(1);
    const rows = within(plans[0]!).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('data-plan-state'))).toEqual([
      'done',
      'running',
      'todo',
    ]);
  });

  it('c06-agent-working carries Stop on the tail and a visible Send now in the composer', async () => {
    await mount({ name: 'c06-agent-working' });
    const cancel = vi.fn(async () => undefined);
    act(() => useAppStore.setState({ cancelCurrentTurn: cancel }));

    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(stop.closest('[data-conversation-tail]')).not.toBeNull();
    fireEvent.click(stop);
    expect(cancel).toHaveBeenCalledWith(C06_SESSION_ID, C06_AGENT_ID, 'user');
    expect(screen.getByRole('button', { name: /^Send now/ }).hasAttribute('disabled')).toBe(true);
  });

  it('c06-agent-finished ends each turn with its summary line and final answer only', async () => {
    await mount({ name: 'c06-agent-finished' });

    expect(screen.getByRole('button', { name: 'Ran 2 commands' })).toBeDefined();
    expect(
      screen.getByText('Dependencies are installed with pnpm and the 24 export tests pass.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('c06-agent-failed counts the failed steps and keeps Retry on the stopped turn', async () => {
    await mount({ name: 'c06-agent-failed' });

    const line = screen.getByRole('button', { name: 'Read 4 files, ran 8 commands (2 errors)' });
    expect(within(line).getByText('(2 errors)')).toBeDefined();
    const send = vi.fn(async () => ({ blockedOverBudget: false }));
    act(() => useAppStore.setState({ sendTurn: send }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Retry/ }));
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: C06_AGENT_ID,
        content: 'Go ahead, then run the export tests.',
      }),
    );
  });

  it('c06-agent-steps expands the steps inline and hands the turn to the transcript pane', async () => {
    await mount({ name: 'c06-agent-steps' });

    const line = screen.getByRole('button', { name: 'Read 4 files, ran 8 commands (2 errors)' });
    expect(line.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Open in transcript' }));
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind === 'transcript' ? drawer.payload.agentId : null).toBe(C06_AGENT_ID);
  });

  it('c06-agent-permission shows the waiting permission inline and no tail', async () => {
    await mount({ name: 'c06-agent-permission' });

    expect(screen.getAllByText(/rm -rf node_modules/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('c06-agent-delegating writes one line per child and opens the child in the pane', async () => {
    await mount({ name: 'c06-agent-delegating' });

    const lines = screen.getByRole('list', { name: 'Delegations' });
    expect(within(lines).getAllByText('Delegated to')).toHaveLength(2);
    fireEvent.click(
      within(lines).getByRole('button', {
        name: 'See more about Run the export tests on 12,000 rows',
      }),
    );
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind === 'transcript' ? drawer.payload.agentId : null).toBe('mock-c06-tester');
  });

  it('c06-agent-transcript keeps every tool call and the narration in the pane', async () => {
    await mount({ name: 'c06-agent-transcript' });

    const pane = screen.getByRole('complementary', { name: 'Transcript pane' });
    expect(within(pane).getByText('Checking the lockfiles first.')).toBeDefined();
    expect(within(pane).queryByRole('button', { name: 'Ran 2 commands' })).toBeNull();
  });

  it('c06-agents-list draws one grid with no actions on the rows, and a row opens the agent', async () => {
    await mount({ name: 'c06-agents-list' });

    const rows = document.querySelectorAll<HTMLElement>('[data-agent-row]');
    expect(rows.length).toBe(2);
    const first = rows[0]!;
    expect(within(first).getByText('Implementer')).toBeDefined();
    expect(within(first).getByText('Running')).toBeDefined();
    expect(within(first).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    act(() => useAppStore.setState({ selectedAgentId: {} }));
    fireEvent.click(first);
    expect(useAppStore.getState().selectedAgentId[C06_SESSION_ID]).toBe(C06_AGENT_ID);
  });

  it('c06-agents-empty says it in one line with the header Start agent', async () => {
    await mount({ name: 'c06-agents-empty' });

    expect(screen.getByText('No agents in this session yet.')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Start agent' })).toHaveLength(1);
  });
});
