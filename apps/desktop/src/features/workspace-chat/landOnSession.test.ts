import { describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { draftAgentOf, landOnSession } from './landOnSession';

const SESSION_ID = 'session-205' as SessionId;

type AgentSeed = Pick<Agent, 'id' | 'ordinal'> & Partial<Agent>;

const agentOf = ({ id, ordinal, ...rest }: AgentSeed): Agent =>
  anAgent({
    id,
    ordinal,
    sessionId: SESSION_ID,
    name: `Agent ${ordinal}`,
    status: 'completed',
    ...rest,
  });

const FIRST = agentOf({ id: 'agent-1' as AgentId, ordinal: 1 });
const SECOND = agentOf({ id: 'agent-2' as AgentId, ordinal: 2 });

type Options = {
  readonly agents?: ReadonlyArray<Agent>;
  readonly pending?: string;
  readonly draft?: string | null;
  readonly load?: () => Promise<void>;
};

const land = async ({
  agents = [FIRST, SECOND],
  pending = '',
  draft = 'Brief',
  load = async () => undefined,
}: Options) => {
  const navigate = vi.fn();
  const setAgentDraft = vi.fn();
  const landed = await landOnSession({
    sessionId: SESSION_ID,
    draft,
    navigate,
    loadPhaseRunsForSession: load,
    readAgents: () => agents,
    readDraft: () => pending,
    setAgentDraft,
  });
  return { landed, navigate, setAgentDraft };
};

describe('draftAgentOf', () => {
  it('picks the latest top-level agent that is not deleted', () => {
    const deleted = agentOf({
      id: 'agent-3' as AgentId,
      ordinal: 3,
      deletedAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    });
    const delegate = agentOf({
      id: 'agent-4' as AgentId,
      ordinal: 4,
      parentAgentId: SECOND.id,
    });

    expect(draftAgentOf({ agents: [FIRST, SECOND, deleted, delegate] })).toBe('agent-2');
  });

  it('picks nothing when the session has no agent', () => {
    expect(draftAgentOf({ agents: [] })).toBeNull();
  });
});

describe('landOnSession', () => {
  it('opens the session overview and stops when there is no draft', async () => {
    const { landed, navigate, setAgentDraft } = await land({ draft: null });

    expect(landed).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ at: 'session', sessionId: SESSION_ID }),
    });
    expect(setAgentDraft).not.toHaveBeenCalled();
  });

  it('puts the brief in the latest agent composer and opens that agent', async () => {
    const { landed, navigate, setAgentDraft } = await land({});

    expect(landed).toBe(true);
    expect(setAgentDraft).toHaveBeenCalledWith('agent-2', 'Brief');
    expect(navigate).toHaveBeenLastCalledWith({
      to: expect.objectContaining({
        view: expect.objectContaining({ agentId: 'agent-2' }),
      }),
      mode: 'replace',
    });
  });

  it('keeps what the composer already holds above the brief', async () => {
    const { setAgentDraft } = await land({ pending: 'Also check the tests' });

    expect(setAgentDraft).toHaveBeenCalledWith('agent-2', 'Also check the tests\n\nBrief');
  });

  it('stays on the overview when the session has no agent to draft into', async () => {
    const { landed, navigate, setAgentDraft } = await land({ agents: [] });

    expect(landed).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(setAgentDraft).not.toHaveBeenCalled();
  });

  it('stays on the overview when the agents fail to load', async () => {
    const { landed, setAgentDraft } = await land({
      load: async () => {
        throw new Error('offline');
      },
    });

    expect(landed).toBe(false);
    expect(setAgentDraft).not.toHaveBeenCalled();
  });
});
