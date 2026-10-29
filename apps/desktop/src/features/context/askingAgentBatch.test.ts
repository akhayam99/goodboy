// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { questionFixture } from '../../__tests__/helpers/actionFixtures';
import { askingAgentBatch } from './askingAgentBatch';

type QuestionFields = {
  readonly id: string;
  readonly agentId: string;
  readonly minute: number;
};

const questionOf = ({ id, agentId, minute }: QuestionFields): OpenQuestion =>
  questionFixture({
    id: brandId<OpenQuestionId>({ value: id }),
    createdByAgentId: brandId<AgentId>({ value: agentId }),
    createdAt: brandId<IsoDateTime>({ value: `2026-09-28T09:0${minute}:00.000Z` }),
  });

type IdsParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const idsOf = ({ questions }: IdsParams): ReadonlyArray<string> =>
  questions.map((question) => question.id);

describe('askingAgentBatch', () => {
  it('returns every question of the asking agent in creation order', () => {
    const questions = askingAgentBatch({
      questions: [
        questionOf({ id: 'q3', agentId: 'a', minute: 3 }),
        questionOf({ id: 'q1', agentId: 'a', minute: 1 }),
        questionOf({ id: 'q2', agentId: 'a', minute: 2 }),
      ],
    });

    expect(idsOf({ questions })).toEqual(['q1', 'q2', 'q3']);
  });

  it('keeps the other agent waiting while the oldest asker has questions', () => {
    const questions = askingAgentBatch({
      questions: [
        questionOf({ id: 'qb', agentId: 'b', minute: 2 }),
        questionOf({ id: 'qa1', agentId: 'a', minute: 1 }),
        questionOf({ id: 'qa2', agentId: 'a', minute: 3 }),
      ],
    });

    expect(idsOf({ questions })).toEqual(['qa1', 'qa2']);
  });

  it('is empty when nothing is asked', () => {
    expect(askingAgentBatch({ questions: [] })).toEqual([]);
  });
});
