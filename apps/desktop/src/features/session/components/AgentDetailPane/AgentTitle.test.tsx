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
import { requestRename } from '../../../actions/renameRequest';
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
});
