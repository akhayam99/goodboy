// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionAttentionReason,
  SessionId,
  TurnState,
} from '@goodboy/types';
import { attentionPlace } from './attentionPlace';

const SESSION_ID = 'session-now' as SessionId;
const EARLIER = 'agent-earlier' as AgentId;
const LATEST = 'agent-latest' as AgentId;
const AT = '2026-10-04T08:00:00.000Z' as IsoDateTime;

type AgentParams = Pick<Agent, 'id' | 'ordinal' | 'status'>;

const agent = ({ id, ordinal, status }: AgentParams): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal,
  name: `Agent ${ordinal}`,
  kind: 'implementer',
  status,
  lastFinishedAt: AT,
});

const AGENTS: ReadonlyArray<Agent> = [
  agent({ id: EARLIER, ordinal: 1, status: 'failed' }),
  agent({ id: LATEST, ordinal: 2, status: 'failed' }),
];

const state = {
  sessionPhaseRuns: { [SESSION_ID]: AGENTS },
  agentTurnState: {
    [EARLIER]: {
      kind: 'blocked',
      runId: 'run-earlier' as ProviderRunId,
      blockedAt: AT,
    } satisfies TurnState,
    [LATEST]: {
      kind: 'blocked',
      runId: 'run-latest' as ProviderRunId,
      blockedAt: AT,
    } satisfies TurnState,
  },
};

type DestinationParams = {
  readonly reason: SessionAttentionReason;
};

const destination = ({ reason }: DestinationParams) =>
  attentionPlace({ state, sessionId: SESSION_ID, reason });

describe('attentionPlace', () => {
  it('opens the questions lens for an open question', () => {
    expect(destination({ reason: 'open-question' })).toMatchObject({
      at: 'session',
      view: { lens: 'questions' },
    });
  });

  it.each([
    ['ci-failed', 'checks'],
    ['changes-requested', 'comments'],
    ['pr-approved', 'comments'],
  ] satisfies ReadonlyArray<readonly [SessionAttentionReason, string]>)(
    'opens the Branch on the tab that answers %s',
    (reason, tab) => {
      expect(destination({ reason })).toMatchObject({
        at: 'session',
        view: { lens: 'branch', target: { kind: 'branch', tab } },
      });
    },
  );

  it.each([
    'agent-error',
    'unread-reply',
    'needs-approval',
  ] satisfies ReadonlyArray<SessionAttentionReason>)(
    'opens the latest actionable agent for %s',
    (reason) => {
      expect(destination({ reason })).toEqual({
        at: 'agent',
        sessionId: SESSION_ID,
        agentId: LATEST,
      });
    },
  );
});
