import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  HandoffSection,
  HandoffSender,
  OpenQuestionId,
  WorkflowRunId,
} from '@goodboy/types';
import { handoffChipLabel, handoffSenderLabel } from './handoffLabels';

const RUN = 'run-1' as WorkflowRunId;
const NO_NAMES = { agentName: null, questionText: null };

describe('handoffSenderLabel', () => {
  it.each<[HandoffSender, string]>([
    [{ kind: 'you' }, 'You'],
    [{ kind: 'orchestrator', workflowRunId: RUN, stepOrdinal: 4 }, 'Orchestrator · step 4'],
    [
      { kind: 'workflowStep', workflowRunId: RUN, stepOrdinal: 3, stepCount: 5 },
      'Workflow step 3 of 5',
    ],
    [
      { kind: 'resolve', threadIds: ['a', 'b', 'c'], prNumber: 412 },
      'Resolve · 3 comments on #412',
    ],
    [{ kind: 'resolve', threadIds: ['a'], prNumber: null }, 'Resolve · 1 comment'],
  ])('names %o', (sender, label) => {
    expect(handoffSenderLabel({ sender, names: NO_NAMES })).toBe(label);
  });

  it('names the agent and the question from the session', () => {
    expect(
      handoffSenderLabel({
        sender: { kind: 'parent', parentAgentId: 'a1' as AgentId, label: 'cluster 2 of 3' },
        names: { agentName: 'Implementer', questionText: null },
      }),
    ).toBe('From Implementer · cluster 2 of 3');
    expect(
      handoffSenderLabel({
        sender: { kind: 'followUp', sourceAgentId: 'a1' as AgentId },
        names: { agentName: 'Scout', questionText: null },
      }),
    ).toBe('Follow-up of Scout');
    expect(
      handoffSenderLabel({
        sender: { kind: 'question', questionId: 'q1' as OpenQuestionId },
        names: { agentName: null, questionText: 'Should the backfill skip 2023?' },
      }),
    ).toBe('Answering for you · Should the backfill skip 2023?');
  });
});

describe('handoffChipLabel', () => {
  const section = (overrides: Partial<HandoffSection>): HandoffSection => ({
    kind: 'ask',
    summary: '',
    bodyMd: '',
    refs: [],
    ...overrides,
  });

  it('counts what can be counted and names the role', () => {
    expect(handoffChipLabel({ section: section({ kind: 'ask' }) })).toBe('Ask');
    expect(
      handoffChipLabel({
        section: section({
          kind: 'earlierSteps',
          refs: [
            { kind: 'agent', agentId: 'a1' as AgentId, ordinal: 1, label: 'Scout', detail: null },
            { kind: 'agent', agentId: 'a2' as AgentId, ordinal: 2, label: 'Plan', detail: null },
          ],
        }),
      }),
    ).toBe('2 earlier steps');
    expect(
      handoffChipLabel({
        section: section({ kind: 'files', refs: [{ kind: 'file', label: 'a.csv', path: null }] }),
      }),
    ).toBe('1 file');
    expect(handoffChipLabel({ section: section({ kind: 'scope' }) })).toBe('Scope and rules');
    expect(handoffChipLabel({ section: section({ kind: 'profile' }) })).toBe('About you');
    expect(
      handoffChipLabel({ section: section({ kind: 'role', summary: 'Implementer · built in' }) }),
    ).toBe('Implementer instructions');
  });
});
