import { describe, expect, it } from 'vitest';
import type { AgentId, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { aPlannerQuestion } from '../../test/planDrawerFixtures';
import { plannerQuestionsOf } from './plannerQuestions';

const PLANNER = 'agent-planner' as AgentId;
const OTHER = 'agent-implementer' as AgentId;

describe('plannerQuestionsOf', () => {
  it('keeps the open questions the planner asked', () => {
    const asked = aPlannerQuestion({ id: 'question-1' as OpenQuestionId });
    const others: ReadonlyArray<OpenQuestion> = [
      aPlannerQuestion({ id: 'question-2' as OpenQuestionId, createdByAgentId: OTHER }),
      aPlannerQuestion({ id: 'question-3' as OpenQuestionId, status: 'answered' }),
    ];

    expect(
      plannerQuestionsOf({ questions: [asked, ...others], plan: { agentId: PLANNER } }),
    ).toEqual([asked]);
  });

  it('is empty when nobody asked', () => {
    expect(plannerQuestionsOf({ questions: [], plan: { agentId: PLANNER } })).toEqual([]);
  });
});
