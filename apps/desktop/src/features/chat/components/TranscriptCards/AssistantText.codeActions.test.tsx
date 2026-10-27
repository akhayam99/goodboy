// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { nextAgentId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { AssistantText } from './AssistantText';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const AGENT_ID = nextAgentId();
const WORKING_DIR = '/wt/payments-api';

const MESSAGE = [
  'Apply the migration, then check the config:',
  '',
  '```bash',
  'pnpm migrate:up',
  '```',
  '',
  '```ts',
  'export const retries = 3;',
  '```',
  '',
  '```',
  'pnpm --filter payments-api test',
  '```',
].join('\n');

let useAppStore: StoryStore;
const writeText = vi.fn(async (_text: string) => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  useAppStore.setState({
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentSessionId: SESSION_ID,
  });
});

afterEach(cleanup);

const mount = () =>
  render(
    <ToastProvider>
      <AssistantText
        text={MESSAGE}
        sessionId={SESSION_ID}
        agentId={AGENT_ID}
        runId="run-1"
        itemKey="assistant-1"
        workingDir={WORKING_DIR}
      />
    </ToastProvider>,
  );

describe('code blocks in an assistant message', () => {
  it('gives every closed block a Copy and only the shell ones a Run in terminal', () => {
    mount();

    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Run in terminal' })).toHaveLength(2);
  });

  it('copies the text of the block it sits on', async () => {
    mount();

    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[1]!);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('export const retries = 3;'));
  });

  it('types the block in a new terminal on the agent folder without pressing Enter', () => {
    mount();

    fireEvent.click(screen.getAllByRole('button', { name: 'Run in terminal' })[0]!);

    const tab = useAppStore.getState().terminalTabs[SESSION_ID]?.[0];
    expect(tab?.cwd).toBe(WORKING_DIR);
    expect(tab?.prefill).toBe('pnpm migrate:up');
    expect(tab?.prefill).not.toMatch(/[\r\n]/);
    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
    expect(storySpies.tauriInvoke).not.toHaveBeenCalledWith('terminal_write', expect.anything());
  });

  it('runs the untagged block that starts like a command', () => {
    mount();

    fireEvent.click(screen.getAllByRole('button', { name: 'Run in terminal' })[1]!);

    expect(useAppStore.getState().terminalTabs[SESSION_ID]?.[0]?.prefill).toBe(
      'pnpm --filter payments-api test',
    );
  });

  it('keeps Copy but drops Run in terminal once the session is archived', () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, archivedAt: STORY_NOW }),
      ],
    });
    mount();

    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Run in terminal' })).toBeNull();
  });
});
