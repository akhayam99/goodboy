// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IntegrationDraft,
  type IntegrationDraftId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type ProviderRunId,
  type SessionId,
  type TurnState,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { attentionSinceOf } from './attentionSinceOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-since' });
const iso = (value: string) => brandId<IsoDateTime>({ value });
const ms = (value: string) => Date.parse(value);

const question = (createdAt: string, status: OpenQuestion['status'] = 'open'): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: createdAt }),
  sessionId: SESSION_ID,
  text: 'Which retry window should the webhook use?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status,
  createdAt: iso(createdAt),
});

const draft = (
  createdAt: string,
  status: IntegrationDraft['status'] = 'pending',
): IntegrationDraft => ({
  id: brandId<IntegrationDraftId>({ value: createdAt }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
  sessionId: SESSION_ID,
  provider: 'slack',
  verb: 'reply',
  target: {},
  body: 'On it.',
  status,
  createdAt,
  updatedAt: createdAt,
  decidedAt: null,
});

const blocked = (blockedAt: string): TurnState => ({
  kind: 'blocked',
  runId: brandId<ProviderRunId>({ value: 'run-1' }),
  blockedAt: iso(blockedAt),
});

const FIRST = anAgent({ id: brandId<AgentId>({ value: 'agent-first' }), sessionId: SESSION_ID });
const SECOND = anAgent({ id: brandId<AgentId>({ value: 'agent-second' }), sessionId: SESSION_ID });

type State = Parameters<typeof attentionSinceOf>[0]['state'];

const since = (
  reason: Parameters<typeof attentionSinceOf>[0]['reason'],
  over: Partial<State> = {},
  session = aSession({ id: SESSION_ID }),
) =>
  attentionSinceOf({
    state: { sessionPhaseRuns: {}, agentTurnState: {}, ...over },
    session,
    reason,
  });

describe('attentionSinceOf', () => {
  it('starts a permission wait at the earliest blocked turn', () => {
    expect(
      since('needs-approval', {
        sessionPhaseRuns: { [SESSION_ID]: [FIRST, SECOND] },
        agentTurnState: {
          [FIRST.id]: blocked('2026-10-07T09:30:00.000Z'),
          [SECOND.id]: blocked('2026-10-07T09:10:00.000Z'),
        },
      }),
    ).toBe(ms('2026-10-07T09:10:00.000Z'));
  });

  it('starts an agent error when the turn failed', () => {
    const session = aSession({
      id: SESSION_ID,
      state: { kind: 'error', message: 'gave up', failedAt: iso('2026-10-07T08:00:00.000Z') },
    });

    expect(since('agent-error', {}, session)).toBe(ms('2026-10-07T08:00:00.000Z'));
  });

  it('starts a question when the oldest open one was asked, and ignores answered ones', () => {
    expect(
      since('open-question', {
        sessionOpenQuestions: {
          [SESSION_ID]: [
            question('2026-10-07T09:00:00.000Z'),
            question('2026-10-07T07:00:00.000Z', 'answered'),
            question('2026-10-07T08:30:00.000Z'),
          ],
        },
      }),
    ).toBe(ms('2026-10-07T08:30:00.000Z'));
  });

  it('starts a Slack reply when the oldest pending draft was written', () => {
    expect(
      since('slack-reply-waiting', {
        sessionSlackDrafts: {
          [SESSION_ID]: [
            draft('2026-10-07T09:00:00.000Z'),
            draft('2026-10-07T08:00:00.000Z', 'sent'),
          ],
        },
      }),
    ).toBe(ms('2026-10-07T09:00:00.000Z'));
  });

  it('starts an unread reply when the oldest unread agent finished', () => {
    const early = { ...FIRST, lastFinishedAt: iso('2026-10-07T06:00:00.000Z') };
    const late = { ...SECOND, lastFinishedAt: iso('2026-10-07T09:00:00.000Z') };
    const seen = {
      ...anAgent({ id: brandId<AgentId>({ value: 'agent-seen' }), sessionId: SESSION_ID }),
      lastFinishedAt: iso('2026-10-07T05:00:00.000Z'),
      lastViewedAt: iso('2026-10-07T05:30:00.000Z'),
    };

    expect(since('unread-reply', { sessionPhaseRuns: { [SESSION_ID]: [late, early, seen] } })).toBe(
      ms('2026-10-07T06:00:00.000Z'),
    );
  });

  it('has no start for a reason the store keeps no time for, and none without a reason', () => {
    expect(since('ci-failed')).toBeNull();
    expect(since('run-stopped')).toBeNull();
    expect(since(null)).toBeNull();
    expect(since('open-question')).toBeNull();
  });
});
