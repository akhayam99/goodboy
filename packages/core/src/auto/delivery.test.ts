import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import { AUTO_RESTART_NOTICE, buildDeliveryText } from './delivery';
import { EMPTY_USER_FACTS, storedDeliveryOf } from './outboxPayload';
import { buildDelegationResult } from './result';

const result = buildDelegationResult({
  delegationId: 'delegation-1',
  attemptId: 'attempt-1',
  treeId: 'tree-1',
  generation: 1,
  childAgentId: 'agent-scout-1',
  role: 'scout',
  routing: { provider: 'anthropic', model: 'sonnet', effort: 'low', reason: 'cheap search' },
  exit: 'ok',
  isTimedOut: false,
  turns: 1,
  durationMs: 5_000,
  closing: parseChildClosing({
    text: 'Three callers.\n<<step-done id="agent-scout-1">>',
    childAgentId: 'agent-scout-1',
  }),
  summary: null,
  summarySource: 'child',
  changedFiles: [],
  checks: [],
  artifacts: [],
  artifactPersistence: 'not_applicable',
  isArtifactExpected: false,
  openQuestions: [],
  costUsd: 0.1,
  reservedCeilingUsd: 0.5,
});

const rows = [
  { id: 'outbox-1', payload: { kind: 'results', batchId: 'batch-1', results: [result] } },
  {
    id: 'outbox-2',
    payload: {
      kind: 'question',
      delegationId: 'delegation-2',
      attemptId: 'attempt-2',
      questionId: 'question-1',
      role: 'implementer',
      childAgentId: 'agent-implementer-1',
      text: 'Which   mount?',
      suggestedAnswers: ['a', 'b'],
      recommendedAnswer: 'a',
    },
  },
  {
    id: 'outbox-3',
    payload: { kind: 'user', text: 'also add tests', facts: EMPTY_USER_FACTS },
  },
  {
    id: 'outbox-4',
    payload: {
      kind: 'user',
      text: 'make step two shorter',
      facts: { ...EMPTY_USER_FACTS, focusArtifactId: 'artifact-plan-1', isAmbiguous: true },
    },
  },
];

const input = {
  ledgerBlock: 'Artifacts in this tree: None yet.',
  budgetLine: 'Budget for this conversation: 5.00 USD.',
  mountsLine: 'MOUNTS: mount-ledger (ledger-core, branch ak/ledger).',
  digestBlock: 'STATE OF THIS CONVERSATION\nNo agent is open.',
  artifactsBlock: '',
  rows,
  childLabels: new Map([['agent-scout-1', 'Scout 2']]),
  isRestart: false,
};

describe('the message that delivers stored rows to Auto', () => {
  it('puts the ledger first, then results, questions and the user messages in order', () => {
    const text = buildDeliveryText(input);
    const order = [
      'Artifacts in this tree',
      'Budget for this conversation',
      'MOUNTS: mount-ledger (ledger-core, branch ak/ledger).',
      'RESULTS FROM YOUR AGENTS',
      'QUESTIONS FROM YOUR AGENTS',
      'MESSAGES FROM THE USER, OLDEST FIRST',
      'also add tests',
      'make step two shorter',
    ].map((part) => text.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('is byte identical when built again from the same rows', () => {
    expect(buildDeliveryText(input)).toBe(buildDeliveryText({ ...input }));
  });

  it('carries the facts the app recorded when the user sent a message', () => {
    const text = buildDeliveryText(input);
    expect(text).toContain('the user had artifact artifact-plan-1 open');
    expect(text).toContain('ask the user');
  });

  it('names each result with the label the user sees on its card', () => {
    const text = buildDeliveryText(input);
    expect(text).toContain('- Scout 2 (scout agent-scout-1, delegation-1): completed');
    expect(text).toContain('as the card of the agent that made it');
    const unnamed = buildDeliveryText({ ...input, childLabels: new Map() });
    expect(unnamed).toContain('- scout agent-scout-1 (delegation-1): completed');
  });

  it('names the question, its options and how to answer', () => {
    const text = buildDeliveryText(input);
    expect(text).toContain('(delegation delegation-2, question question-1)');
    expect(text).toContain('Which mount?');
    expect(text).toContain('options: a | b');
    expect(text).toContain('answer block for delegation delegation-2 and question question-1');
  });

  it('adds the restart notice first when the answer was cut short', () => {
    const text = buildDeliveryText({ ...input, isRestart: true });
    expect(text.startsWith(AUTO_RESTART_NOTICE)).toBe(true);
  });

  it('ignores a row whose payload it does not know', () => {
    const text = buildDeliveryText({ ...input, rows: [{ id: 'x', payload: { kind: 'other' } }] });
    expect(text).not.toContain('RESULTS');
  });

  it('reads back the delivery text stored on the first row', () => {
    expect(
      storedDeliveryOf({ value: { delivery: { text: 'hello', rowIds: ['a', 7, 'b'] } } }),
    ).toEqual({ text: 'hello', rowIds: ['a', 'b'] });
    expect(storedDeliveryOf({ value: { kind: 'user' } })).toBeNull();
  });
});

describe('refusals and the state digest in a delivery', () => {
  const refusal = {
    kind: 'refusal',
    runId: 'run-1',
    action: 'delegate',
    code: 'budget',
    text: 'The budget left does not cover this batch.\nchild 1: budget',
  };

  it('shows a refusal with its code and per child lines, before the results', () => {
    const text = buildDeliveryText({
      ...input,
      rows: [...rows, { id: 'refusal-row', payload: refusal }],
    });

    expect(text).toContain('REFUSED, NOT DONE');
    expect(text).toContain('your delegate block was refused (budget):');
    expect(text).toContain('  child 1: budget');
    expect(text.indexOf('REFUSED, NOT DONE')).toBeLessThan(
      text.indexOf('RESULTS FROM YOUR AGENTS'),
    );
  });

  it('places the digest and the artifact text around the results', () => {
    const text = buildDeliveryText({
      ...input,
      digestBlock: 'STATE OF THIS CONVERSATION\nOpen agents:',
      artifactsBlock: 'ARTIFACT artifact-1 (report) "Report" v1\nbody text',
    });

    const order = ['Budget for this', 'STATE OF THIS', 'RESULTS FROM', 'ARTIFACT artifact-1'].map(
      (part) => text.indexOf(part),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(order.every((index) => index >= 0)).toBe(true);
  });
});
