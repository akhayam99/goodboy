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
    const mark = within(row).getByTestId('agent-header-provider');
    expect(mark.getAttribute('aria-label')).toBe('Claude');
    expect(mark.textContent).toBe('');
    expect(within(row).queryByRole('button', { name: 'Rename agent' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'View transcript' })).toBeDefined();
    expect(within(row).getByRole('button', { name: 'More agent actions' })).toBeDefined();
    expect(within(row).queryByText('Running')).toBeNull();
    expect(within(row).queryByText('Sonnet 5.5')).toBeNull();
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
    expect(within(line).getByText('2 errors')).toBeDefined();
    expect(within(line).queryByText('(2 errors)')).toBeNull();
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

  it('c06-agent-steps opens the transcript pane at that turn, with no inline step list', async () => {
    await mount({ name: 'c06-agent-steps' });

    const line = screen.getByRole('button', { name: 'Read 4 files, ran 8 commands (2 errors)' });
    expect(line.getAttribute('aria-expanded')).toBeNull();
    fireEvent.click(line);
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind === 'transcript' ? drawer.payload.agentId : null).toBe(C06_AGENT_ID);
    expect(drawer?.kind === 'transcript' ? drawer.payload.turn : null).toBe(1);
    const pane = screen.getByRole('complementary', { name: 'Transcript pane' });
    expect(pane.querySelector('[data-turn-heading="1"]')).not.toBeNull();
  });

  it('c06-agent-permission shows the waiting permission inline and no tail', async () => {
    await mount({ name: 'c06-agent-permission' });

    expect(screen.getAllByText(/rm -rf node_modules/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('c06-agent-delegating writes one line per child and opens the child in the pane', async () => {
    await mount({ name: 'c06-agent-delegating' });

    const lines = screen.getByRole('list', { name: 'Delegations' });
    expect(within(lines).queryByText('Delegated to')).toBeNull();
    expect(within(lines).getAllByRole('listitem')).toHaveLength(2);
    expect(within(lines).getByText('Run the export tests on 12,000 rows')).toBeDefined();
    fireEvent.click(
      within(lines).getByRole('button', {
        name: 'Open Run the export tests on 12,000 rows',
      }),
    );
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind === 'transcript' ? drawer.payload.agentId : null).toBe('mock-c06-tester');
  });

  it('c06-agent-transcript shows the steps per turn only, titled Transcript, with no second composer', async () => {
    await mount({ name: 'c06-agent-transcript' });

    const pane = screen.getByRole('complementary', { name: 'Transcript pane' });
    expect(within(pane).getByRole('heading', { name: 'Transcript' })).toBeDefined();
    expect(within(pane).queryByText('Checking the lockfiles first.')).toBeNull();
    expect(pane.querySelectorAll('[data-turn-heading]').length).toBeGreaterThan(0);
    expect(within(pane).queryByRole('button', { name: 'Turn detail' })).toBeNull();
    expect(within(pane).queryByRole('textbox')).toBeNull();
    expect(within(pane).queryByRole('button', { name: 'Ran 2 commands' })).toBeNull();
  });

  it('c06-agents-list lists the agents as rows of Runs, and a row opens the agent', async () => {
    await mount({ name: 'c06-agents-list' });

    const rows = screen.getAllByRole('button', { name: /^Open .+, One agent, / });
    expect(rows.length).toBe(2);
    const first = rows[0]!;
    expect(within(first).getByText('Was an agent · Implementer')).toBeDefined();
    expect(within(first).getAllByText('Running').length).toBeGreaterThan(0);
    expect(within(first).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Start an agent' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Autopilot' })).toBeNull();
    expect(document.querySelector('[data-slot="pane-meta"]')).toBeNull();
    act(() => useAppStore.setState({ selectedAgentId: {} }));
    fireEvent.click(first);
    expect(useAppStore.getState().selectedAgentId[C06_SESSION_ID]).toBe(C06_AGENT_ID);
  });

  it('c06-agent-working keeps the turn footer to model, time and cost', async () => {
    await mount({ name: 'c06-agent-working' });

    const footer = screen.getAllByRole('button', { name: 'Turn detail' })[0]!;
    expect(footer.textContent).toContain('Sonnet 5.5');
    expect(footer.textContent).not.toMatch(/ in · /);
    expect(footer.textContent).not.toContain('cached');
    expect(footer.textContent).not.toContain('%');
  });

  it('c06-agent-working opens on the first message as a user bubble, no eyebrow', async () => {
    await mount({ name: 'c06-agent-working' });

    expect(screen.queryByText('First message')).toBeNull();
    expect(screen.queryByText('Older format')).toBeNull();
  });

  it('c06-agent-working composer names the agent, the next model and one primary', async () => {
    await mount({ name: 'c06-agent-working' });

    const box = screen.getByRole('textbox');
    expect(box.getAttribute('placeholder') ?? box.getAttribute('aria-placeholder')).toBe(
      'Message Implementer',
    );
    const chip = screen.getByRole('button', { name: /^Model routing:/ });
    expect(chip.textContent).toContain('Sonnet 5.5');
    expect(chip.textContent).not.toMatch(/^Model/);
    expect(screen.queryByRole('button', { name: 'Reset routing override' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Queue/ })).toBeDefined();
  });

  it('c06-agent-working tail speaks in sentence case', async () => {
    await mount({ name: 'c06-agent-working' });

    const tail = document.querySelector<HTMLElement>('[data-conversation-tail]')!;
    expect(tail.textContent).toMatch(/^[A-Z]/);
  });

  it('c06-agent-finished folds the brief to one Asked line after the first answer', async () => {
    await mount({ name: 'c06-agent-finished' });

    const brief = screen.getByRole('button', { name: /^Asked: Reinstall dependencies/ });
    expect(brief.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(brief);
    expect(screen.getByText(/The lockfile changed on main\./)).toBeDefined();
  });

  it('c06-agent-menu holds Rename in the header menu, the title has no rename icon', async () => {
    await mount({ name: 'c06-agent-menu' });

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeDefined();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(screen.getByRole('textbox', { name: 'Rename agent' })).toBeDefined();
  });

  it('c06-turn-detail opens the turn popover with the cost the footer line leaves out', async () => {
    await mount({ name: 'c06-turn-detail' });

    expect(screen.getByText('Cost')).toBeDefined();
    expect(screen.getByText('Input')).toBeDefined();
    expect(screen.getByText(/estimated at API prices/)).toBeDefined();
  });

  it('c06-agent-transcript toggles the header verb to a pressed Hide transcript', async () => {
    await mount({ name: 'c06-agent-finished' });

    fireEvent.click(screen.getByRole('button', { name: 'View transcript' }));
    const hide = screen.getByRole('button', { name: 'Hide transcript' });
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hide);
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('c06-agents-empty shows the empty Runs page as the Start a run field, no Start an agent', async () => {
    await mount({ name: 'c06-agents-empty' });

    expect(screen.getByRole('textbox', { name: 'Start a run' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start an agent' })).toBeNull();
  });
});
