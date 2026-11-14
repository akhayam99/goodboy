// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type PlanId,
  type PlanWithCount,
  type SessionId,
} from '@goodboy/types';
import { overviewTileFactsOf } from './overviewTileFactsOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const stampOf = (value: string) => brandId<IsoDateTime>({ value });

type QuestionParams = {
  readonly id: string;
  readonly isBlocking: boolean;
  readonly status: OpenQuestion['status'];
};

const questionOf = ({ id, isBlocking, status }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION_ID,
  text: 'Cap per day or per payout?',
  suggestedAnswers: [],
  isBlocking,
  userAnswer: null,
  status,
  createdAt: stampOf('2026-11-01T09:00:00.000Z'),
});

type PlanParams = {
  readonly id: string;
  readonly updatedAt: string;
};

const planOf = ({ id, updatedAt }: PlanParams): PlanWithCount => ({
  id: brandId<PlanId>({ value: id }),
  sessionId: SESSION_ID,
  agentId: brandId<AgentId>({ value: 'agent-northwind' }),
  title: 'Cap payouts',
  bodyMd: '## Steps',
  status: 'active',
  createdAt: stampOf('2026-11-01T09:00:00.000Z'),
  updatedAt: stampOf(updatedAt),
  consumptionCount: 0,
});

describe('overviewTileFactsOf', () => {
  it('counts open questions and the blocking ones among them', () => {
    const facts = overviewTileFactsOf({
      questions: [
        questionOf({ id: 'q1', isBlocking: true, status: 'open' }),
        questionOf({ id: 'q2', isBlocking: false, status: 'open' }),
        questionOf({ id: 'q3', isBlocking: true, status: 'answered' }),
      ],
      plans: [],
      artifacts: [],
      agents: [],
    });

    expect(facts.openQuestions).toBe(2);
    expect(facts.blockingQuestions).toBe(1);
  });

  it('names the newest artifact time and nothing when there is none', () => {
    const facts = overviewTileFactsOf({
      questions: [],
      plans: [
        planOf({ id: 'p1', updatedAt: '2026-11-01T10:00:00.000Z' }),
        planOf({ id: 'p2', updatedAt: '2026-11-03T10:00:00.000Z' }),
      ],
      artifacts: [],
      agents: [],
    });

    expect(facts.artifacts).toBe(2);
    expect(facts.newestArtifactAt).toBe(Date.parse('2026-11-03T10:00:00.000Z'));
    expect(
      overviewTileFactsOf({ questions: [], plans: [], artifacts: [], agents: [] }).newestArtifactAt,
    ).toBeNull();
  });
});
