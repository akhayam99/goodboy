import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import { parseDelegateSpec } from './delegateSpec';
import { buildStateDigest } from './digest';
import { buildDeliveryText } from './delivery';
import { composeAnswerKickoff, composeDelegationKickoff } from './kickoff';
import { buildAutoSystemPrompt } from './prompt';
import { delegationDepthOf, isAutoSubstepRole, parseSubstepNeeds, substepLinkOf } from './substep';

const ID = 'agent-implementer-1';

describe('substep roles and links', () => {
  it('names the scout and the investigator as the only roles a child can ask for', () => {
    expect(parseSubstepNeeds({ role: 'scout' })).toBe('scout');
    expect(parseSubstepNeeds({ role: 'investigator' })).toBe('investigator');
    expect(parseSubstepNeeds({ role: 'implementer' })).toBeNull();
    expect(parseSubstepNeeds({ role: undefined })).toBeNull();
    expect(isAutoSubstepRole({ role: 'reviewer' })).toBe(false);
  });

  it('reads the parent link and the depth from a request, one level for a plain child', () => {
    const request = {
      parent: { delegationId: 'delegation-1', questionId: 'question-1', depth: 2 },
    };
    expect(substepLinkOf({ request })).toEqual({
      delegationId: 'delegation-1',
      questionId: 'question-1',
      depth: 2,
    });
    expect(delegationDepthOf({ request })).toBe(2);
    expect(substepLinkOf({ request: { parent: 'x' } })).toBeNull();
    expect(substepLinkOf({ request: { parent: { delegationId: 'd' } } })).toBeNull();
    expect(delegationDepthOf({ request: {} })).toBe(1);
  });
});

describe('a child that needs a scout', () => {
  it('reads the needs attribute of its blocking question', () => {
    const closing = parseChildClosing({
      text: `Stuck.\n<<ctx-question blocking="true" needs="scout">>Where is the retry limit?<</ctx-question>>`,
      childAgentId: ID,
    });
    expect(closing.question).toMatchObject({ text: 'Where is the retry limit?', needs: 'scout' });
  });

  it('drops a role it cannot ask for and leaves a plain question alone', () => {
    const writer = parseChildClosing({
      text: `<<ctx-question blocking="true" needs="implementer">>Fix it?<</ctx-question>>`,
      childAgentId: ID,
    });
    expect(writer.question).not.toHaveProperty('needs');
    const plain = parseChildClosing({
      text: `<<ctx-question blocking="true">>Which branch?<</ctx-question>>`,
      childAgentId: ID,
    });
    expect(plain.question).not.toHaveProperty('needs');
  });
});

describe('the spec of a substep', () => {
  const spec = (child: Record<string, unknown>) =>
    parseDelegateSpec({ text: JSON.stringify({ children: [child] }) });

  it('reads forQuestion and hashes it apart from the same work without it', () => {
    const base = { role: 'scout', task: 'find it', reason: 'reading code' };
    const plain = spec(base);
    const linked = spec({ ...base, forQuestion: 'question-1' });
    expect(linked).toMatchObject({ kind: 'ok', children: [{ forQuestion: 'question-1' }] });
    expect(plain).toMatchObject({ kind: 'ok', children: [{ forQuestion: null }] });
    expect(linked.kind === 'ok' && plain.kind === 'ok' && linked.hash !== plain.hash).toBe(true);
  });

  it('refuses a retry that also names a question', () => {
    expect(
      spec({ retryOf: 'delegation-1', reason: 'again', forQuestion: 'question-1' }),
    ).toMatchObject({
      kind: 'refused',
      code: 'spec_invalid',
    });
  });
});

describe('what Auto and the child read about substeps', () => {
  it('tells a child how to ask, and a substep that it cannot', () => {
    const params = {
      role: 'implementer',
      childAgentId: ID,
      task: 'add the export',
      doneWhen: null,
      expected: null,
      inputs: [],
      revise: null,
      mountLabel: null,
    } as const;
    expect(composeDelegationKickoff(params)).toContain('needs="scout"');
    expect(composeDelegationKickoff({ ...params, isSubstep: true })).not.toContain('needs="scout"');
  });

  it('puts the handed over report in the answer', () => {
    const text = composeAnswerKickoff({
      childAgentId: ID,
      question: 'Where is it?',
      answer: 'See the report.',
      report: 'Scout report (version 1)\nIn retry.ts',
    });
    expect(text).toContain('**Report handed over**\nScout report (version 1)\nIn retry.ts');
    expect(composeAnswerKickoff({ childAgentId: ID, question: 'q', answer: 'a' })).not.toContain(
      'Report handed over',
    );
  });

  it('says in the digest and in the question block what a substep costs', () => {
    const digest = buildStateDigest({
      nowMs: 1_000_000,
      delegations: [
        {
          id: 'delegation-1',
          role: 'implementer',
          state: 'paused',
          outcome: null,
          task: 'add the export',
          createdAt: 0,
          question: { questionId: 'question-1', text: 'Where is it?', needs: 'scout' },
        },
        {
          id: 'delegation-2',
          role: 'scout',
          state: 'running',
          outcome: null,
          task: 'find it',
          createdAt: 0,
          question: null,
          parentId: 'delegation-1',
        },
      ],
    });
    expect(digest).toContain('It asks for a scout');
    expect(digest).toContain('"forQuestion"');
    expect(digest).toContain('one delegation and two attempts');
    expect(digest).toContain('delegation-2 scout (helps delegation-1)');
    const delivery = buildDeliveryText({
      ledgerBlock: '',
      budgetLine: '',
      mountsLine: '',
      digestBlock: '',
      artifactsBlock: '',
      childLabels: new Map(),
      isRestart: false,
      rows: [
        {
          id: 'outbox-1',
          payload: {
            kind: 'question',
            delegationId: 'delegation-1',
            attemptId: 'attempt-1',
            questionId: 'question-1',
            role: 'implementer',
            childAgentId: ID,
            text: 'Where is it?',
            suggestedAnswers: [],
            recommendedAnswer: null,
            needs: 'investigator',
          },
        },
      ],
    });
    expect(delivery).toContain('It asks for a investigator');
  });

  it('documents forQuestion and the artifact of an answer in the Auto prompt', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });
    expect(prompt).toContain('"forQuestion":"<question id>"');
    expect(prompt).toContain('"artifact":"<artifact id>"');
  });
});
