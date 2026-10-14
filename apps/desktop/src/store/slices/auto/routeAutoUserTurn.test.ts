// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../features/auto/autoUserTurnPort';
import type { SendTurnInput } from '../turn/types';
import { routeAutoUserTurn, type RouteAutoUserTurnParams } from './routeAutoUserTurn';

type AutoTurnState = ReturnType<RouteAutoUserTurnParams['get']>;

const AUTO_ATTACHMENTS_MESSAGE = 'Auto does not take files in a message yet.';
const AUTO_MESSAGE_LOST_MESSAGE = 'Auto could not take your message. Send it again in a moment.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const AUTO_AGENT = brandId<AgentId>({ value: 'agent-auto' });
const CHILD_AGENT = brandId<AgentId>({ value: 'agent-implementer' });
const NESTED_AGENT = brandId<AgentId>({ value: 'agent-nested' });

type AgentRow = AutoTurnState['sessionPhaseRuns'][SessionId][number];

const autoRow: AgentRow = { id: AUTO_AGENT, kind: 'auto', parentAgentId: undefined };

type HarnessParams = {
  readonly agents: ReadonlyArray<AgentRow>;
};

const harness = ({ agents }: HarnessParams) => {
  const reportError = vi.fn(async () => undefined);
  const state: AutoTurnState = {
    sessions: [{ id: SESSION, workspaceId: WORKSPACE }],
    sessionPhaseRuns: { [SESSION]: agents },
    selectedAgentId: { [SESSION]: AUTO_AGENT },
    reportError,
  };
  return { reportError, get: () => state };
};

const inputOf = (overrides: Partial<SendTurnInput> = {}): SendTurnInput => ({
  sessionId: SESSION,
  agentId: AUTO_AGENT,
  content: 'Also cover the notify-relay retries',
  ...overrides,
});

afterEach(() => {
  registerAutoUserTurnPort({ port: null });
});

describe('a message typed to an Auto agent', () => {
  it('goes through the Auto door with the workspace of its session', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({ agents: [autoRow] });
    const onStarted = vi.fn();

    const result = await routeAutoUserTurn({ get, input: inputOf({ onStarted }) });

    expect(result).toEqual({ blockedOverBudget: false });
    expect(port).toHaveBeenCalledWith({
      agentId: AUTO_AGENT,
      sessionId: SESSION,
      workspaceId: WORKSPACE,
      text: 'Also cover the notify-relay retries',
    });
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('follows the selected agent when the send names none', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({ agents: [autoRow] });

    await routeAutoUserTurn({
      get,
      input: { sessionId: SESSION, content: 'Also cover the notify-relay retries' },
    });

    expect(port).toHaveBeenCalledWith(expect.objectContaining({ agentId: AUTO_AGENT }));
  });

  it('is refused out loud when Auto lost it, and no turn is started', async () => {
    registerAutoUserTurnPort({ port: vi.fn<AutoUserTurnPort>(async () => 'lost') });
    const { get, reportError } = harness({ agents: [autoRow] });

    await expect(routeAutoUserTurn({ get, input: inputOf() })).rejects.toThrow(
      AUTO_MESSAGE_LOST_MESSAGE,
    );

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Auto didn't get your message", sessionId: SESSION }),
    );
  });

  it('is refused out loud when it carries files, and the door is not asked', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get, reportError } = harness({ agents: [autoRow] });
    const attachments = [
      {
        id: 'attachment-1',
        fileName: 'notes.md',
        mimeType: 'text/markdown',
        dataBase64: 'bm90ZXM=',
      },
    ];

    await expect(
      routeAutoUserTurn({
        get,
        input: inputOf({ attachments }),
      }),
    ).rejects.toThrow(AUTO_ATTACHMENTS_MESSAGE);

    expect(port).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('is left to the plain turn when there is no Auto door', async () => {
    const { get } = harness({ agents: [autoRow] });

    expect(await routeAutoUserTurn({ get, input: inputOf() })).toBeNull();
  });

  it('leaves a delivery, a workflow turn and a continuation to the plain turn', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({ agents: [autoRow] });

    for (const origin of ['delegation', 'workflow', 'mount-continuation'] as const) {
      expect(await routeAutoUserTurn({ get, input: inputOf({ origin }) })).toBeNull();
    }
    expect(port).not.toHaveBeenCalled();
  });

  it('leaves agents that are not the root of an Auto tree to the plain turn', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({
      agents: [
        autoRow,
        { id: CHILD_AGENT, kind: 'implementer', parentAgentId: AUTO_AGENT },
        { id: NESTED_AGENT, kind: 'auto', parentAgentId: AUTO_AGENT },
      ],
    });

    expect(await routeAutoUserTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) })).toBeNull();
    expect(
      await routeAutoUserTurn({
        get,
        input: inputOf({ agentId: NESTED_AGENT }),
      }),
    ).toBeNull();
    expect(port).not.toHaveBeenCalled();
  });
});
