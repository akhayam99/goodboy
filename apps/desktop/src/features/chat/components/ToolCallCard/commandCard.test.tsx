// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  nextAgentId,
  nextProviderRunId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryAgent,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../utils/transcript-items';
import { ToolCallCard } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

type ToolItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const AGENT_ID = nextAgentId();
const COMMAND = 'pnpm --filter payments-api test -- --run settlement';
const WORKING_DIR = '/wt/payments-api';

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
    sessionPhaseRuns: { [SESSION_ID]: [buildStoryAgent({ id: AGENT_ID, sessionId: SESSION_ID })] },
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
  });
});

afterEach(cleanup);

const toolOf = (overrides: Partial<ToolItem>): ToolItem => ({
  kind: 'tool_call',
  key: 'tool-1',
  toolUseId: '1',
  toolName: 'Bash',
  input: { command: COMMAND },
  output: 'FAIL settlement.test.ts\n  expected 3 got 2\n',
  isError: true,
  ended: true,
  runId: nextProviderRunId(),
  startedAt: STORY_NOW,
  endedAt: STORY_NOW,
  ...overrides,
});

type MountParams = {
  readonly item?: ToolItem;
  readonly sessionId?: typeof SESSION_ID | null;
};

const mount = ({ item = toolOf({}), sessionId = SESSION_ID }: MountParams = {}) => {
  render(
    <ToolCallCard item={item} sessionId={sessionId} agentId={AGENT_ID} workingDir={WORKING_DIR} />,
  );
  fireEvent.click(screen.getByRole('button', { expanded: false }));
};

describe('a command tool card', () => {
  it('opens to the command and its output in monospace blocks', () => {
    mount();

    expect(screen.getByTestId('tool-command').textContent).toBe(`$ ${COMMAND}`);
    expect(screen.getByTestId('tool-output').textContent).toContain('FAIL settlement.test.ts');
    expect(screen.queryByText('command')).toBeNull();
  });

  it('shows the exit code of a shell call in the output heading', () => {
    mount({
      item: toolOf({
        toolName: 'shell',
        output: { aggregated_output: 'FAIL postings\n', exit_code: 1 },
      }),
    });

    screen.getByText('output, exit 1');
  });

  it('copies the command and the output', async () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(COMMAND));
    fireEvent.click(screen.getByRole('button', { name: 'Copy output' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('FAIL settlement.test.ts\n  expected 3 got 2\n'),
    );
  });

  it('types the command in a new terminal on the folder the agent ran in and does not run it', () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Run in terminal' }));

    const tab = useAppStore.getState().terminalTabs[SESSION_ID]?.[0];
    expect(tab?.cwd).toBe(WORKING_DIR);
    expect(tab?.prefill).toBe(COMMAND);
    expect(tab?.prefill).not.toMatch(/[\r\n]/);
    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
    expect(storySpies.tauriInvoke).not.toHaveBeenCalledWith('terminal_write', expect.anything());
  });

  it('attaches the command and its output for the agent that ran it and sends nothing', () => {
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Ask about this output' }));

    const queued = useAppStore.getState().outputHandoffs[AGENT_ID];
    expect(queued).toHaveLength(1);
    expect(queued?.[0]?.title).toBe(
      'Output of pnpm --filter payments-api test -- --run settlem…, Failed',
    );
    expect(queued?.[0]?.text).toContain(`$ ${COMMAND}`);
    expect(queued?.[0]?.text).toContain('expected 3 got 2');
    expect(storySpies.tauriInvoke).not.toHaveBeenCalled();
  });

  it('collapses a long output to its last 40 lines and shows all on demand', () => {
    const lines = Array.from({ length: 120 }, (_, index) => `step ${index + 1} ok`);
    mount({ item: toolOf({ isError: false, output: lines.join('\n') }) });

    const output = screen.getByTestId('tool-output');
    expect(output.textContent?.split('\n')).toHaveLength(40);
    expect(output.textContent).toContain('step 120 ok');
    expect(output.textContent).not.toContain('step 80 ok');

    fireEvent.click(screen.getByRole('button', { name: 'Show all 120 lines' }));

    expect(screen.getByTestId('tool-output').textContent?.split('\n')).toHaveLength(120);
    fireEvent.click(screen.getByRole('button', { name: 'Show the last 40 lines' }));
    expect(screen.getByTestId('tool-output').textContent?.split('\n')).toHaveLength(40);
  });

  it('offers the command verbs while the call runs, without output verbs', () => {
    mount({ item: toolOf({ ended: false, endedAt: null, output: null, isError: false }) });

    screen.getByRole('button', { name: 'Copy command' });
    screen.getByRole('button', { name: 'Run in terminal' });
    expect(screen.queryByRole('button', { name: 'Copy output' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask about this output' })).toBeNull();
  });

  it('keeps Ask about this output off when there is nothing to show', () => {
    mount({ item: toolOf({ output: '', isError: false }) });

    screen.getByText('No output');
    const ask = screen.getByRole<HTMLButtonElement>('button', { name: 'Ask about this output' });
    expect(ask.disabled).toBe(true);
  });

  it('hides the terminal and ask verbs in an archived session', () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, archivedAt: STORY_NOW }),
      ],
    });
    mount();

    screen.getByRole('button', { name: 'Copy command' });
    expect(screen.queryByRole('button', { name: 'Run in terminal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask about this output' })).toBeNull();
  });

  it('hides the terminal and ask verbs outside a session', () => {
    mount({ sessionId: null });

    expect(screen.queryByRole('button', { name: 'Run in terminal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask about this output' })).toBeNull();
  });

  it('keeps the raw view and shows the old fields for a tool that is not a command', () => {
    mount({ item: toolOf({ toolName: 'Read', input: { path: '/a.ts' }, output: 'x' }) });

    expect(screen.queryByTestId('tool-command')).toBeNull();
    screen.getByText('path');
  });
});
