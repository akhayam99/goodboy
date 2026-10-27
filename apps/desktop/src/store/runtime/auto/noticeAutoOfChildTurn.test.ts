// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../features/auto/autoUserTurnPort';
import type { SendTurnInput } from '../../slices/turn/types';
import { noticeAutoOfChildTurn } from './noticeAutoOfChildTurn';

type NoticeState = ReturnType<Parameters<typeof noticeAutoOfChildTurn>[0]['get']>;

type AgentRow = NoticeState['sessionPhaseRuns'][SessionId][number];

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const AUTO_AGENT = brandId<AgentId>({ value: 'agent-auto' });
const CHILD_AGENT = brandId<AgentId>({ value: 'agent-implementer' });
const PLAIN_PARENT = brandId<AgentId>({ value: 'agent-planner' });
const PLAIN_CHILD = brandId<AgentId>({ value: 'agent-scout' });

const ROWS: ReadonlyArray<AgentRow> = [
  { id: AUTO_AGENT, kind: 'auto', name: 'Auto', parentAgentId: undefined },
  { id: CHILD_AGENT, kind: 'implementer', name: 'Implementer', parentAgentId: AUTO_AGENT },
  { id: PLAIN_PARENT, kind: 'planner', name: 'Planner', parentAgentId: undefined },
  { id: PLAIN_CHILD, kind: 'scout', name: 'Scout', parentAgentId: PLAIN_PARENT },
];

const harness = () => {
  const reportError = vi.fn(async () => undefined);
  const state: NoticeState = {
    sessions: [{ id: SESSION, workspaceId: WORKSPACE }],
    sessionPhaseRuns: { [SESSION]: ROWS },
    selectedAgentId: { [SESSION]: CHILD_AGENT },
    reportError,
  };
  return { reportError, get: () => state };
};

type InputParams = {
  readonly agentId: AgentId;
  readonly origin?: SendTurnInput['origin'];
};

const inputOf = ({ agentId, origin }: InputParams): SendTurnInput => ({
  sessionId: SESSION,
  agentId,
  content: 'Keep MAX_RETRY_ATTEMPTS in config.ts',
  ...(origin !== undefined && { origin }),
});

afterEach(() => {
  registerAutoUserTurnPort({ port: null });
});

describe('a message typed to a child Auto started', () => {
  it('tells Auto what the user wrote, once, on the Auto door', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness();

    await noticeAutoOfChildTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) });

    expect(port).toHaveBeenCalledOnce();
    expect(port).toHaveBeenCalledWith({
      agentId: AUTO_AGENT,
      sessionId: SESSION,
      workspaceId: WORKSPACE,
      text: 'I wrote to the Implementer you started: Keep MAX_RETRY_ATTEMPTS in config.ts',
    });
  });

  it('leaves Auto itself, a child of a plain agent and a non operator turn alone', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness();

    await noticeAutoOfChildTurn({ get, input: inputOf({ agentId: AUTO_AGENT }) });
    await noticeAutoOfChildTurn({ get, input: inputOf({ agentId: PLAIN_CHILD }) });
    await noticeAutoOfChildTurn({
      get,
      input: inputOf({ agentId: CHILD_AGENT, origin: 'delegation' }),
    });

    expect(port).not.toHaveBeenCalled();
  });

  it('reports a note Auto lost and lets the message to the child go on', async () => {
    registerAutoUserTurnPort({ port: async () => 'lost' });
    const { get, reportError } = harness();

    await expect(
      noticeAutoOfChildTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) }),
    ).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Auto did not see what you told Implementer' }),
    );
  });

  it('does nothing in a window with no Auto runtime', async () => {
    const { get, reportError } = harness();

    await noticeAutoOfChildTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) });

    expect(reportError).not.toHaveBeenCalled();
  });
});
