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

  it('puts the oldest wait first and answers a question in place', () => {
    const { moves } = needsYouOf({ sessions: SESSIONS, infos: INFOS, openQuestions: QUESTIONS });
    expect(moves.map((move) => [move.title, move.kind])).toEqual([
      ['Checks failing', 'page'],
      ['Needs approval', 'page'],
      ['Raise the payout limit?', 'answer'],
      ['Keep the webhook retry?', 'answer'],
    ]);
  });

  it('leaves an approved pull request with green checks to Ready to merge', () => {
    const { moves } = needsYouOf({ sessions: SESSIONS, infos: INFOS, openQuestions: QUESTIONS });
    expect(moves.some((move) => move.sessionId === ACME.id)).toBe(false);
  });

  it('keeps one move that opens the page when the questions are not read yet', () => {
    const { moves } = needsYouOf({ sessions: [HARBORLINE], infos: INFOS, openQuestions: {} });
    expect(moves).toEqual([
      expect.objectContaining({ kind: 'page', title: '2 questions for you', question: null }),
    ]);
  });

  it('opens the page for a question that takes several choices', () => {
    const many: OpenQuestion = {
      ...questionOf({
        id: 'q-many',
        sessionId: HARBORLINE.id,
        text: 'Which regions?',
        createdAt: '1970-01-01T00:00:01.000Z',
      }),
      selectMode: 'many',
    };
    const { moves } = needsYouOf({
      sessions: [HARBORLINE],
      infos: INFOS,
      openQuestions: { [HARBORLINE.id]: [many] },
    });
    expect(moves.map((move) => [move.title, move.kind])).toEqual([['Which regions?', 'page']]);
  });

  it('says nothing waits when no session needs you', () => {
    expect(needsYouOf({ sessions: [ACME, CASCADIA], infos: INFOS, openQuestions: {} })).toEqual({
      sessionCount: 0,
      moveCount: 0,
      moves: [],
      notNowCount: 0,
      notNowIds: [],
    });
  });

  it('sets aside a queued answer and a move put off, and counts only the one put off', () => {
    const needsYou = needsYouOf({
      sessions: SESSIONS,
      infos: INFOS,
      openQuestions: QUESTIONS,
      notNow: new Set([`${NORTHWIND.id}:ci-failed`]),
      queued: new Set([`${HARBORLINE.id}:question:q-retry`]),
    });
    expect(needsYou.moveCount).toBe(2);
    expect(needsYou.notNowCount).toBe(1);
    expect(needsYou.notNowIds).toEqual([`${NORTHWIND.id}:ci-failed`]);
    expect(needsYou.sessionCount).toBe(2);
  });
});
