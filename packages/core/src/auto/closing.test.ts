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

  it('keeps the head and the last line of a long reply, marked as cut', () => {
    const body = Array.from(
      { length: 60 },
      (_value, index) => `Section ${index} ${'x'.repeat(90)}`,
    );
    const text = `${body.join('\n\n')}\nLast line: payments-api is green.\n<<step-done id="${ID}">>`;
    const closing = parseChildClosing({ text, childAgentId: ID });
    expect(text.length).toBeGreaterThan(6_000);
    expect(closing.summary.length).toBeLessThanOrEqual(4_000);
    expect(closing.summary.startsWith('Section 0 ')).toBe(true);
    expect(closing.summary).toContain('middle dropped');
    expect(closing.summary.endsWith('Last line: payments-api is green.')).toBe(true);
    expect(closing.completion).toBe('done');
  });

  it('keeps a reply under the budget whole and unmarked', () => {
    const closing = parseChildClosing({ text: 'Short report.', childAgentId: ID });
    expect(closing.summary).toBe('Short report.');
  });

  it('still reads a blocked status and a question from the dropped middle of a long reply', () => {
    const filler = 'y'.repeat(3_000);
    const text = `${filler}\n<<ctx-question blocking="true">>Which branch?<</ctx-question>>\n${filler}\n<<step-done id="${ID}" status="blocked">>`;
    const closing = parseChildClosing({ text, childAgentId: ID });
    expect(closing.completion).toBe('blocked');
    expect(closing.question?.text).toBe('Which branch?');
    expect(closing.summary).toContain('middle dropped');
  });

  it('reads a long run of dashes in a closing line', () => {
    const dashes = '-'.repeat(50_000);
    const unmatched = parseChildClosing({
      text: `<<step-done ${dashes}>>`,
      childAgentId: ID,
    });
    const unterminated = parseChildClosing({
      text: `<<step-done ${dashes} id="${ID}>>`,
      childAgentId: ID,
    });
    const matched = parseChildClosing({
      text: `<<step-done ${dashes} id="${ID}" ${dashes}>>`,
      childAgentId: ID,
    });
    expect(unmatched.completion).toBe('none');
    expect(unterminated.completion).toBe('none');
    expect(matched.completion).toBe('done');
  });

  it('reads attributes written with spaces around the equals sign', () => {
    const closing = parseChildClosing({
      text: `<<step-done status = "blocked" id = "${ID}">>`,
      childAgentId: ID,
    });
    expect(closing.completion).toBe('blocked');
  });

  it('reads the closing line in the forms providers print', () => {
    const forms = [
      `\`<<step-done id="${ID}">>\``,
      `<<step-done id='${ID}'>>`,
      `<<step-done id=${ID}>>`,
      `\\<\\<step-done id="${ID}"\\>\\>`,
      `<< step-done id=“${ID}” >>`,
      `<<step-done id="${ID}">`,
    ];
    for (const form of forms) {
      const closing = parseChildClosing({
        text: `Done.\n${form}\nOne more line.`,
        childAgentId: ID,
      });
      expect(closing.completion, form).toBe('done');
    }
  });

  it('reads a block written with a bare status value', () => {
    const closing = parseChildClosing({
      text: `Cannot go on.\n<<step-done id=${ID} status=blocked>>`,
      childAgentId: ID,
    });
    expect(closing.completion).toBe('blocked');
  });

  it('still ignores another agent in every form', () => {
    const closing = parseChildClosing({
      text: `\`<<step-done id='agent-other'>>\``,
      childAgentId: ID,
    });
    expect(closing.completion).toBe('none');
  });
});
