// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { NAMES } from '../../../../../shared/utils/names';
import { SessionAskLine } from './index';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-implementer' });

type LiveWork = () => Promise<unknown>;

const tauri: { isDbDown: boolean; commands: Array<string>; liveWork: LiveWork | null } = {
  isDbDown: false,
  commands: [],
  liveWork: null,
};

const LIVE_ROWS = [
  {
    runId: 'run-harborline',
    sessionId: 'session-harborline',
    agentId: 'agent-implementer',
    mountId: null,
    tool: { name: 'Edit', command: null, path: 'src/retry/state.ts' },
    hasToolCall: true,
    canSeeTools: true,
  },
];

type InvokeParams = {
  readonly command: string;
};

const answerOf = async ({ command }: InvokeParams): Promise<unknown> => {
  tauri.commands.push(command);
  if (command === 'live_work') {
    return tauri.liveWork === null ? LIVE_ROWS : tauri.liveWork();
  }
  if (!command.startsWith('db_')) {
    return null;
  }
  if (tauri.isDbDown) {
    throw new Error('database is locked');
  }
  if (command === 'db_transaction') {
    return { status: 'committed', results: [] };
  }
  return command === 'db_select' ? [] : { rowsAffected: 1 };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  tauri.isDbDown = false;
  tauri.commands = [];
  tauri.liveWork = null;
  storySpies.tauriInvoke.mockImplementation((command) => answerOf({ command: String(command) }));
  useAppStore.setState({
    sessions: [aSession({ id: SESSION, goal: 'Keep the retry count after a redelivery' })],
    sessionPhaseRuns: {
      [SESSION]: [
        anAgent({ id: AGENT, sessionId: SESSION, name: 'Implementer', status: 'running' }),
      ],
    },
    agentTurnState: {
      [AGENT]: {
        kind: 'running',
        runId: brandId<ProviderRunId>({ value: 'run-harborline' }),
        startedAt: brandId<IsoDateTime>({ value: '2026-11-21T09:00:00.000Z' }),
      },
    },
  });
});

afterEach(() => {
  cleanup();
});

const askDoing = async () => {
  fireEvent.click(screen.getByRole('button', { name: NAMES.whatAreYouDoing }));
  await screen.findByText('The Implementer: Editing state.ts.');
};

describe('the Ask line', () => {
  it('answers What are you doing? from the session, with no turn', async () => {
    render(<SessionAskLine sessionId={SESSION} />);

    await askDoing();

    expect(screen.getByTestId('ask-line-origin').textContent).toBe(NAMES.fromTheSession);
    screen.getByText('The agent was not interrupted.');
    expect(tauri.commands).not.toContain('ask_turn');
    expect(Object.keys(useAppStore.getState().askMessages)).toEqual([]);
  });

  it('says there is no plan instead of guessing what is left', async () => {
    render(<SessionAskLine sessionId={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: NAMES.whatIsLeft }));

    await screen.findByText(`${NAMES.noPlanOnThisSession}.`);
    expect(screen.getByTestId('ask-line-origin').textContent).toBe(NAMES.fromTheSession);
  });

  it('drops a late answer to an older question', async () => {
    let release: (rows: unknown) => void = () => undefined;
    tauri.liveWork = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    render(<SessionAskLine sessionId={SESSION} />);
    fireEvent.click(screen.getByRole('button', { name: NAMES.whatAreYouDoing }));
    fireEvent.click(screen.getByRole('button', { name: 'Close answer' }));
    fireEvent.click(screen.getByRole('button', { name: NAMES.whatIsLeft }));
    await screen.findByText(`${NAMES.noPlanOnThisSession}.`);

    await act(async () => {
      release(LIVE_ROWS);
    });

    expect(screen.queryByText('The Implementer: Editing state.ts.')).toBeNull();
    screen.getByText(`${NAMES.noPlanOnThisSession}.`);
  });

  it('shows a failed answer with Retry, and Retry answers', async () => {
    tauri.liveWork = async () => {
      throw new Error('live work is not readable');
    };
    render(<SessionAskLine sessionId={SESSION} />);
    fireEvent.click(screen.getByRole('button', { name: NAMES.whatAreYouDoing }));
    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't answer");

    tauri.liveWork = null;
    fireEvent.click(screen.getByRole('button', { name: NAMES.retry }));

    await screen.findByText('The Implementer: Editing state.ts.');
  });

  it('keeps a message that could not be queued, and Retry queues it once', async () => {
    render(<SessionAskLine sessionId={SESSION} />);
    await askDoing();
    fireEvent.click(screen.getByRole('button', { name: 'Message the Implementer' }));
    const field = screen.getByRole('textbox', { name: 'Message the Implementer' });
    fireEvent.change(field, { target: { value: 'Run the state tests before the PR' } });
    tauri.isDbDown = true;

    fireEvent.click(screen.getByRole('button', { name: NAMES.send }));

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't queue the message");
    expect(screen.getByRole('textbox', { name: 'Message the Implementer' })).toHaveProperty(
      'value',
      'Run the state tests before the PR',
    );
    expect(useAppStore.getState().agentQueue[AGENT] ?? []).toEqual([]);

    tauri.isDbDown = false;
    fireEvent.click(screen.getByRole('button', { name: NAMES.retry }));

    await screen.findByText('In the queue of the Implementer. It was not interrupted.');
    expect(useAppStore.getState().agentQueue[AGENT]?.map((item) => item.content)).toEqual([
      'Run the state tests before the PR',
    ]);
  });
});
