// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId, type ResolveAttempt, type SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { requestRename } from '../../../../shared/utils/renameRequest';
import { agentObjectKey } from '../../../actions/agentObjectKey';
import { AgentTitle } from './AgentTitle';

const sessionId = brandId<SessionId>({ value: 'session-1' });
const agentId = brandId<AgentId>({ value: 'agent-1' });
const agent = anAgent({
  id: agentId,
  sessionId,
  name: 'Implement chat',
  status: 'completed',
  kind: 'implementer',
});

type AttemptParams = {
  readonly id: string;
  readonly threadIds: ReadonlyArray<string>;
  readonly createdAt: number;
};

const anAttempt = ({ id, threadIds, createdAt }: AttemptParams): ResolveAttempt => ({
  id,
  sessionId,
  agentId,
  prNumber: 318,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

let useAppStore: Awaited<ReturnType<typeof importStore>>;
const renameAgent = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  renameAgent.mockClear();
  useAppStore.setState({ renameAgent });
});

afterEach(cleanup);

const askToRename = () =>
  act(() => {
    requestRename({
      objectKey: agentObjectKey({ agentId }),
      anchorKey: `agent-header:${agentId}`,
    });
  });

describe('AgentTitle', () => {
  it('reads the agent name with no rename icon beside it', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);

    expect(screen.getByText('Implement chat')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename agent' })).toBeNull();
  });

  it('names an automatic fix run title by its pull request and comments, as the Activity row does', () => {
    useAppStore.setState({
      sessionResolveAttempts: {
        [sessionId]: [
          anAttempt({ id: 'a1', threadIds: ['t1', 't2'], createdAt: 1 }),
          anAttempt({ id: 'a2', threadIds: ['t3'], createdAt: 2 }),
        ],
      },
    });
    render(
      <AgentTitle
        agent={{ ...agent, kind: 'resolver', name: 'Resolve: 3 review comments' }}
        sessionId={sessionId}
      />,
    );

    expect(screen.getByText('Fix run · #318 · 3 comments')).toBeDefined();
    expect(screen.queryByText(/^Resolve:/)).toBeNull();
  });

  it('titles an agent named after its role with its brief, so the role is not said twice', () => {
    render(
      <AgentTitle
        agent={{ ...agent, kind: 'planner', name: 'Planner' }}
        sessionId={sessionId}
        brief="Plan the ledger-core retry window"
      />,
    );

    expect(screen.getByText('Plan the ledger-core retry window')).toBeDefined();
    expect(screen.queryByText('Planner')).toBeNull();
  });

  it('opens the field when the header menu asks to rename', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);

    askToRename();

    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('opens the field on a double click, as the agent card does', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);

    fireEvent.doubleClick(screen.getByText('Implement chat'));

    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('saves the new name on Enter', async () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);
    askToRename();

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Ship the chat dock' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await vi.waitFor(() => expect(renameAgent).toHaveBeenCalledTimes(1));

    expect(renameAgent).toHaveBeenCalledWith(sessionId, 'agent-1', 'Ship the chat dock');
  });

  it('refuses an empty name and leaves the agent alone', () => {
    render(<AgentTitle agent={agent} sessionId={sessionId} />);
    askToRename();

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(renameAgent).not.toHaveBeenCalled();
  });

  it('opens the full brief from the title and keeps double click rename', () => {
    render(
      <AgentTitle
        agent={{ ...agent, name: 'Implementer' }}
        sessionId={sessionId}
        brief={'Check ledger-core.\nKeep the second credit out of payments-api.'}
      />,
    );
    screen.getByText('Check ledger-core.');
    expect(screen.queryByText(/Keep the second credit/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Read full brief' }));
    const full = screen.getByText(/Keep the second credit out of payments-api\./);
    screen.getByRole('button', { name: 'Hide full brief' });
    fireEvent.doubleClick(full);
    screen.getByRole('textbox', { name: 'Rename agent' });
  });

  it('renames a brief titled agent after a real click then double click on the same line', () => {
    render(
      <AgentTitle
        agent={{ ...agent, name: 'Implementer' }}
        sessionId={sessionId}
        brief={'Check ledger-core.\nKeep the second credit out of payments-api.'}
      />,
    );
    const line = screen.getByText('Check ledger-core.');

    fireEvent.click(line);

    expect(line.isConnected).toBe(true);
    fireEvent.doubleClick(line);
    screen.getByRole('textbox', { name: 'Rename agent' });
  });

  it('caps the opened brief in a scroll region, so a long one never squeezes the chat', () => {
    render(
      <AgentTitle
        agent={{ ...agent, name: 'Implementer' }}
        sessionId={sessionId}
        brief={`Check ledger-core.\n${'Keep the second credit out of payments-api. '.repeat(80)}`}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Read full brief' }));

    const region = screen.getByText(/Keep the second credit/).closest('.max-h-48');
    expect(region).not.toBeNull();
  });

  it('keeps the title a plain name, with no brief button, once the agent is named', () => {
    render(
      <AgentTitle
        agent={{ ...agent, name: 'Ledger retry review' }}
        sessionId={sessionId}
        brief="Check ledger-core."
      />,
    );
    expect(screen.queryByRole('button', { name: 'Read full brief' })).toBeNull();
    screen.getByText('Ledger retry review');
  });

  it('keeps the field and the old name when the save fails, then retries on Enter and cancels on Escape', async () => {
    renameAgent.mockRejectedValueOnce(new Error('disk is full'));
    render(<AgentTitle agent={agent} sessionId={sessionId} />);
    askToRename();

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Ship the chat dock' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await vi.waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByRole('textbox')).toBe(field);

    fireEvent.keyDown(field, { key: 'Enter' });
    await vi.waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(renameAgent).toHaveBeenCalledTimes(2);

    askToRename();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    screen.getByText('Implement chat');
  });
});
