// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import {
  agentFixture,
  questionFixture,
  runFixture,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';
import { classifyAgent } from '../agent-kind';
import type { TimelineAgentEntry, TimelineRunEntry } from './buildTimelineGroups';
import { runIdentity } from './runIdentity';
import { runOpenQuestion } from './runOpenQuestion';

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

type AgentFields = {
  readonly id: string;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const agentEntry = ({ id, questions }: AgentFields): TimelineAgentEntry => {
  const agent = agentFixture({ id: brandId<AgentId>({ value: id }) });
  return {
    kind: 'agent',
    id: `agent:${id}`,
    at: null,
    ordinal: 0,
    agent,
    agentKind: classifyAgent({ agent, override: null }),
    isMissingArtifact: false,
    stepLabel: `step ${id}`,
    openQuestions: questions,
    terminalQuestions: [],
    children: [],
    answers: [],
    hasDuration: false,
    chain: null,
  };
};

const runOf = (children: ReadonlyArray<TimelineAgentEntry>): TimelineRunEntry => ({
  kind: 'run',
  id: 'run:run-settlement',
  at: '2026-09-28T09:00:00.000Z',
  run: runFixture(),
  workflow: workflowFixture(),
  identity: runIdentity({ laneIndex: 0, seed: 0 }),
  children,
  producedPlan: null,
});

describe('runOpenQuestion', () => {
  it('shows the oldest question of the oldest asker first', () => {
    const entry = runOf([
      agentEntry({ id: 'b', questions: [questionOf({ id: 'qb', agentId: 'b', minute: 2 })] }),
      agentEntry({
        id: 'a',
        questions: [
          questionOf({ id: 'qa2', agentId: 'a', minute: 3 }),
          questionOf({ id: 'qa1', agentId: 'a', minute: 1 }),
        ],
      }),
    ]);

    expect(runOpenQuestion({ entry })?.question.id).toBe('qa1');
  });

  it('skips a question already shown as a row', () => {
    const entry = runOf([
      agentEntry({
        id: 'a',
        questions: [
          questionOf({ id: 'q1', agentId: 'a', minute: 1 }),
          questionOf({ id: 'q2', agentId: 'a', minute: 2 }),
        ],
      }),
    ]);

    expect(runOpenQuestion({ entry, shownQuestionIds: new Set(['q1']) })?.question.id).toBe('q2');
  });

  it('hands the run to the next agent once the first agent only has shown questions', () => {
    const entry = runOf([
      agentEntry({ id: 'a', questions: [questionOf({ id: 'qa', agentId: 'a', minute: 1 })] }),
      agentEntry({ id: 'b', questions: [questionOf({ id: 'qb', agentId: 'b', minute: 2 })] }),
    ]);

    expect(runOpenQuestion({ entry, shownQuestionIds: new Set(['qa']) })?.question.id).toBe('qb');
  });

  it('is null when the run asks nothing', () => {
    expect(runOpenQuestion({ entry: runOf([]) })).toBeNull();
  });
});
