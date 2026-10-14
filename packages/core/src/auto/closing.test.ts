import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';

const ID = 'agent-scout-1';

describe('reading how a child closed its work', () => {
  it('reads the closing line addressed to this exact agent', () => {
    const closing = parseChildClosing({
      text: `Found three callers.\n<<step-done id="${ID}">>`,
      childAgentId: ID,
    });
    expect(closing).toMatchObject({ completion: 'done', question: null });
    expect(closing.summary).toContain('Found three callers.');
    expect(closing.summary).not.toContain('step-done');
  });

  it('reads a declared block', () => {
    const closing = parseChildClosing({
      text: `Cannot build.\n<<step-done id="${ID}" status="blocked">>`,
      childAgentId: ID,
    });
    expect(closing.completion).toBe('blocked');
  });

  it('ignores a closing line addressed to another agent', () => {
    const closing = parseChildClosing({
      text: '<<step-done id="agent-other">>',
      childAgentId: ID,
    });
    expect(closing.completion).toBe('none');
  });

  it('reads no closing line as none, never as done', () => {
    expect(parseChildClosing({ text: 'All finished.', childAgentId: ID }).completion).toBe('none');
  });

  it('reads a blocking question with its options', () => {
    const closing = parseChildClosing({
      text: 'I need a choice.\n<<ctx-question blocking="true" suggestions="main|release" recommended="main">>Which branch?<</ctx-question>>',
      childAgentId: ID,
    });
    expect(closing.question).toEqual({
      text: 'Which branch?',
      suggestedAnswers: ['main', 'release'],
      recommendedAnswer: 'main',
    });
  });

  it('does not treat a question that does not block as a question to answer', () => {
    const closing = parseChildClosing({
      text: '<<ctx-question>>Optional thought?<</ctx-question>>',
      childAgentId: ID,
    });
    expect(closing.question).toBeNull();
  });

  it('keeps only the tail of a long reply as the summary', () => {
    const closing = parseChildClosing({ text: `${'a'.repeat(5_000)}END`, childAgentId: ID });
    expect(closing.summary.length).toBe(2_000);
    expect(closing.summary.endsWith('END')).toBe(true);
  });
});
