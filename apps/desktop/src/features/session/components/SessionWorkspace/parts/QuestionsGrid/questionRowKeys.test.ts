// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type OpenQuestionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import type { QuestionBranchGroup, QuestionBranchRow } from '../questionsLensModel';
import { questionBranchRowKeyOf, selectedQuestionRowKeyOf } from './questionRowKeys';

const SESSION = nextSessionId();
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const Q = brandId<OpenQuestionId>({ value: 'q-credit' });
const OTHER = brandId<OpenQuestionId>({ value: 'q-retry' });

type ItemParams = {
  readonly id: OpenQuestionId;
};

const itemOf = ({ id }: ItemParams): QuestionBranchRow => ({
  row: {
    kind: 'waiting',
    question: {
      id,
      sessionId: SESSION,
      text: id,
      suggestedAnswers: [],
      isBlocking: false,
      userAnswer: null,
      status: 'open',
      createdAt: AT,
    },
  },
  branches: [],
});

type GroupParams = {
  readonly key: string;
  readonly ids: ReadonlyArray<OpenQuestionId>;
};

const groupOf = ({ key, ids }: GroupParams): QuestionBranchGroup => ({
  key,
  head: { kind: 'none' },
  waiting: ids.map((id) => itemOf({ id })),
  answered: [],
});

describe('selectedQuestionRowKeyOf', () => {
  it('keeps the copy that was pressed while its group still holds the question', () => {
    const groups = [groupOf({ key: 'mount:a', ids: [Q] }), groupOf({ key: 'mount:b', ids: [Q] })];
    const picked = questionBranchRowKeyOf({ groupKey: 'mount:b', questionId: Q });

    expect(selectedQuestionRowKeyOf({ groups, selectedId: Q, pickedRowKey: picked })).toBe(picked);
  });

  it('falls back to the first group when the pressed group no longer holds the question', () => {
    const groups = [
      groupOf({ key: 'mount:a', ids: [Q] }),
      groupOf({ key: 'mount:b', ids: [OTHER] }),
    ];
    const picked = questionBranchRowKeyOf({ groupKey: 'mount:b', questionId: Q });

    expect(selectedQuestionRowKeyOf({ groups, selectedId: Q, pickedRowKey: picked })).toBe(
      questionBranchRowKeyOf({ groupKey: 'mount:a', questionId: Q }),
    );
  });

  it('selects nothing when no group holds the question any more', () => {
    const groups = [groupOf({ key: 'mount:b', ids: [OTHER] })];
    const picked = questionBranchRowKeyOf({ groupKey: 'mount:b', questionId: Q });

    expect(selectedQuestionRowKeyOf({ groups, selectedId: Q, pickedRowKey: picked })).toBeNull();
  });
});
