// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, OpenQuestionId, WorkflowRunId } from '@goodboy/types';
import { askButtons, type AskButtonFacts } from './askButtons';
import type { AskHandle } from './askHandles';
import { parseAskAnswer } from './parseAskAnswer';

const IMPLEMENTER = 'agent-impl' as AgentId;
const QUESTION = 'q-1' as OpenQuestionId;

const HANDLES: ReadonlyArray<AskHandle> = [
  { key: 'A2', label: 'Implementer', target: { kind: 'agent', agentId: IMPLEMENTER } },
  { key: 'Q1', label: 'Question 1', target: { kind: 'question', questionId: QUESTION } },
  { key: 'R1', label: 'Fix run', target: { kind: 'run', runId: 'run-fix' as WorkflowRunId } },
];

const FACTS: AskButtonFacts = {
  openQuestions: [{ id: QUESTION, number: 1 }],
  messageableAgents: [{ id: IMPLEMENTER, name: 'Implementer' }],
  readyCount: 5,
};

const answer = (text: string) => parseAskAnswer({ text, handles: HANDLES });

describe('askButtons', () => {
  it('offers answer, review and tell when the verbs are available', () => {
    const buttons = askButtons({
      answer: answer(
        '**[[Q1]] blocks [[A2]].** [[R1]] has 5 ready.\n<<suggest target="Q1">>Stop after 5.<</suggest>>',
      ),
      facts: FACTS,
    });
    expect(buttons.map((button) => button.label)).toEqual([
      'Answer question 1',
      'Review 5 to review',
      'Tell Implementer…',
    ]);
    expect(buttons[0]).toMatchObject({ kind: 'answer', prefill: 'Stop after 5.' });
    expect(buttons[2]).toMatchObject({ kind: 'tell', prefill: '' });
  });

  it('shows no button for a verb the registry does not offer right now', () => {
    const buttons = askButtons({
      answer: answer('**[[Q1]] blocks [[A2]].** [[R1]] runs.'),
      facts: { openQuestions: [], messageableAgents: [], readyCount: 0 },
    });
    expect(buttons).toEqual([]);
  });

  it('never executes anything: every button reads, navigates or prefills', () => {
    const buttons = askButtons({
      answer: answer(
        '**[[A2]] should update the test.**\n<<suggest target="A2">>Update the test.<</suggest>>',
      ),
      facts: FACTS,
    });
    expect(buttons).toEqual([
      {
        kind: 'tell',
        key: `tell:${IMPLEMENTER}`,
        label: 'Tell Implementer…',
        agentId: IMPLEMENTER,
        prefill: 'Update the test.',
      },
    ]);
  });
});
