// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type SessionId,
  type SessionStageInfo,
} from '@goodboy/types';
import { sessionFixture } from '../../../__tests__/helpers/actionFixtures';
import { attentionCountOf } from '../../../store/slices/session-view/attentionCountOf';
import { needsYouOf } from './needsYouOf';

type InfoParams = {
  readonly patch: Partial<SessionStageInfo>;
};

const infoOf = ({ patch }: InfoParams): SessionStageInfo => ({
  stage: 'attention',
  reason: '',
  addsFact: false,
  attention: null,
  prState: null,
  ...patch,
});

type QuestionParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly text: string;
  readonly createdAt: string;
};

const questionOf = ({ id, sessionId, text, createdAt }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId,
  text,
  suggestedAnswers: ['Keep the retry', 'Drop it'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: brandId<IsoDateTime>({ value: createdAt }),
});

const HARBORLINE = sessionFixture({ id: brandId<SessionId>({ value: 'harborline-payouts' }) });
const NORTHWIND = sessionFixture({ id: brandId<SessionId>({ value: 'northwind-ledger' }) });
const ACME = sessionFixture({ id: brandId<SessionId>({ value: 'acme-notify' }) });
const CASCADIA = sessionFixture({ id: brandId<SessionId>({ value: 'cascadia-settle' }) });

const INFOS: Readonly<Record<string, SessionStageInfo>> = {
  [HARBORLINE.id]: infoOf({
    patch: { attention: 'open-question', openQuestionCount: 2, attentionSince: 3_000 },
  }),
  [NORTHWIND.id]: infoOf({
    patch: { attention: 'ci-failed', otherReasons: ['plan-approval'], attentionSince: 1_000 },
  }),
  [ACME.id]: infoOf({ patch: { attention: 'pr-approved', attentionSince: 500 } }),
  [CASCADIA.id]: infoOf({ patch: { stage: 'running', attention: null } }),
};

const QUESTIONS = {
  [HARBORLINE.id]: [
    questionOf({
      id: 'q-retry',
      sessionId: HARBORLINE.id,
      text: 'Keep the webhook retry?',
      createdAt: '1970-01-01T00:00:04.000Z',
    }),
    questionOf({
      id: 'q-limit',
      sessionId: HARBORLINE.id,
      text: 'Raise the payout limit?',
      createdAt: '1970-01-01T00:00:02.000Z',
    }),
  ],
};

const SESSIONS = [HARBORLINE, NORTHWIND, ACME, CASCADIA];

describe('needsYouOf, the one count of what waits on you', () => {
  it('counts the same sessions as the places rail and one move per thing to do', () => {
    const needsYou = needsYouOf({ sessions: SESSIONS, infos: INFOS, openQuestions: QUESTIONS });
    const rail = attentionCountOf({
      items: SESSIONS.flatMap((session) => {
        const info = INFOS[session.id];
        return info === undefined ? [] : [{ id: session.id, info }];
      }),
    });
    expect(needsYou.sessionCount).toBe(rail.count);
    expect(needsYou.sessionCount).toBe(2);
    expect(needsYou.moveCount).toBe(needsYou.moves.length);
    expect(needsYou.moveCount).toBe(4);
  });

  it('puts the oldest wait first, one move per open question', () => {
    const { moves } = needsYouOf({ sessions: SESSIONS, infos: INFOS, openQuestions: QUESTIONS });
    expect(moves.map((move) => [move.title, move.reason])).toEqual([
      ['Checks failing', 'ci-failed'],
      ['Needs approval', 'plan-approval'],
      ['Raise the payout limit?', 'open-question'],
      ['Keep the webhook retry?', 'open-question'],
    ]);
  });

  it('leaves an approved pull request with green checks to the merge train', () => {
    const { moves } = needsYouOf({ sessions: SESSIONS, infos: INFOS, openQuestions: QUESTIONS });
    expect(moves.some((move) => move.sessionId === ACME.id)).toBe(false);
  });

  it('keeps one move for the session when the questions are not read yet', () => {
    const { moves } = needsYouOf({ sessions: [HARBORLINE], infos: INFOS, openQuestions: {} });
    expect(moves).toEqual([
      expect.objectContaining({
        id: `${HARBORLINE.id}:open-question`,
        title: '2 questions for you',
      }),
    ]);
  });

  it('says nothing waits when no session needs you', () => {
    expect(needsYouOf({ sessions: [ACME, CASCADIA], infos: INFOS, openQuestions: {} })).toEqual({
      sessionCount: 0,
      moveCount: 0,
      moves: [],
      cards: [],
    });
  });

  it('draws one card per counted session, the oldest wait first, with its question count', () => {
    const { cards, sessionCount } = needsYouOf({
      sessions: SESSIONS,
      infos: INFOS,
      openQuestions: QUESTIONS,
    });
    expect(cards).toHaveLength(sessionCount);
    expect(cards.map((card) => [card.sessionId, card.move.title, card.questionCount])).toEqual([
      [NORTHWIND.id, 'Checks failing', 0],
      [HARBORLINE.id, 'Raise the payout limit?', 2],
    ]);
  });
});
