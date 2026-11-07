// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_C06_CONVERSATION_SCENES } from './c06-conversation';
import { C06_AGENT_ID } from './c06ConversationSeed';

const SETTLE_MS = 1_500;

let useAppStore: StoryStore;

type SceneName = keyof typeof U25_C06_CONVERSATION_SCENES;

type MountParams = {
  readonly name: SceneName;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U25_C06_CONVERSATION_SCENES[name];
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const openAgentMenu = async (): Promise<HTMLElement> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
    await vi.advanceTimersByTimeAsync(50);
  });
  return screen.getByRole('menu');
};

describe('agent rows stay reachable from the one conversation', () => {
  it('Agent menu: four rows keep Rename, Copy last reply and Delete', async () => {
    await mount({ name: 'c06-agent-finished' });

    const menu = await openAgentMenu();
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    for (const label of [/^Rename/, /^Copy last reply/, /^Delete agent/]) {
      within(menu).getByRole('menuitem', { name: label });
    }
    expect(within(menu).queryByRole('menuitem', { name: /^Copy name/ })).toBeNull();
  });

  it('Stop: one Stop on screen, in the dock, and none in the header menu', async () => {
    await mount({ name: 'c06-agent-working' });

    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
    const menu = await openAgentMenu();
    expect(within(menu).queryByRole('menuitem', { name: /^Stop/ })).toBeNull();
  });

  it('Brief outcome: the closing reply carries the outcome, with no band restating it', async () => {
    await mount({ name: 'c06-agent-finished' });

    expect(screen.queryByRole('heading', { name: 'Outcome' })).toBeNull();
    expect(
      screen.getByText('Dependencies are installed with pnpm and the 24 export tests pass.'),
    ).toBeDefined();
  });

  it('Brief subagents: each child is a delegation line that opens it in the pane', async () => {
    await mount({ name: 'c06-agent-delegating' });

    expect(
      within(screen.getByRole('list', { name: 'Delegations' })).getAllByRole('button', {
        name: /^Open /,
      }),
    ).toHaveLength(2);
  });

  it('Every tool call payload: the summary line opens the transcript pane, where the steps show', async () => {
    await mount({ name: 'c06-agent-steps' });

    const stepsPane = screen.getByRole('complementary', { name: 'Transcript pane' });
    expect(within(stepsPane).getAllByText(/^Ran /).length).toBeGreaterThan(0);
    cleanup();
    await mount({ name: 'c06-agent-transcript' });
    const pane = screen.getByRole('complementary', { name: 'Transcript pane' });
    expect(within(pane).getAllByText(/^(Ran|Read) /).length).toBeGreaterThan(0);
  });

  it('Agent usage footer: the transcript pane carries the agent usage', async () => {
    await mount({ name: 'c06-agent-transcript' });

    const pane = screen.getByRole('complementary', { name: 'Transcript pane' });
    expect(within(pane).getByRole('button', { name: 'Usage detail' })).toBeDefined();
  });

  it('Turn footer tokens and cost: each finished turn keeps its footer detail', async () => {
    await mount({ name: 'c06-agent-finished' });

    expect(screen.getAllByRole('button', { name: 'Turn detail' }).length).toBeGreaterThan(0);
  });

  it('Enter queues and Send now reads now: both words come with a draft while a turn runs', async () => {
    await mount({ name: 'c06-agent-working' });

    expect(screen.queryByRole('button', { name: /^Queue/ })).toBeNull();
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'keep the flag' } });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByRole('button', { name: /^Queue/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Send now/ })).toBeDefined();
  });

  it('Failed with Retry: a failed turn keeps its Retry in the dock and says failed here', async () => {
    await mount({ name: 'c06-agent-failed' });

    expect(screen.getByText('Failed here')).toBeDefined();
    expect(screen.queryByText('Stopped')).toBeNull();
    expect(screen.getByRole('button', { name: /^Retry/ })).toBeDefined();
  });

  it('Permission card whole: the waiting permission is inline with its decisions', async () => {
    await mount({ name: 'c06-agent-permission' });

    expect(screen.getAllByRole('button', { name: /Allow|Deny/ }).length).toBeGreaterThan(0);
  });

  it('Agents list and counts: the Runs grid lists running and finished agents', async () => {
    await mount({ name: 'c06-agents-list' });

    const list = screen.getByRole('list', { name: 'Runs' });
    expect(within(list).getAllByText('Done').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.queryByText('Completed')).toBeNull();
  });

  it('Start an agent: the Runs page starts a role from Start a run with @, no popover', async () => {
    await mount({ name: 'c06-agents-list' });

    expect(screen.queryByRole('button', { name: 'Start an agent' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start a run' }));
    expect(screen.getByRole('textbox', { name: 'Start a run' })).toBeDefined();
  });

  it('Rename, close and delete from a list row: the row right click menu keeps them', async () => {
    await mount({ name: 'c06-agents-list' });

    const [row] = screen.getAllByRole('button', { name: /, Agent, Running$/ });
    expect(row).toBeDefined();
    await act(async () => {
      fireEvent.contextMenu(row!);
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByRole('menuitem', { name: /^Delete agent/ })).toBeDefined();
  });
});
