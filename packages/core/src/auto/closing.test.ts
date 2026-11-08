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

  it('reads an old declared block as a return with no needs', () => {
    const closing = parseChildClosing({
      text: `Cannot build.\n<<step-done id="${ID}" status="blocked">>`,
      childAgentId: ID,
    });
    expect(closing.completion).toBe('blocked');
    expect(closing.returned).toEqual({ needs: null, request: 'Cannot build.' });
  });

  it('reads every needs value of a return', () => {
    const cases = [
      ['shell', { kind: 'shell' }],
      ['writer', { kind: 'writer' }],
      ['role:planner', { kind: 'role', role: 'planner' }],
      ['decision', { kind: 'decision' }],
      ['user', { kind: 'user' }],
    ] as const;
    for (const [value, needs] of cases) {
      const closing = parseChildClosing({
        text: `Partial report.\n<<step-done id="${ID}" status="returned" needs="${value}">>\nWhat I need.`,
        childAgentId: ID,
      });
      expect(closing.completion, value).toBe('blocked');
      expect(closing.returned, value).toEqual({ needs, request: 'What I need.' });
    }
  });

  it('reads a return with no needs as needs missing', () => {
    const closing = parseChildClosing({
      text: `Partial.\n<<step-done id="${ID}" status="returned">>\nA shell.`,
      childAgentId: ID,
    });
    expect(closing.returned).toEqual({ needs: null, request: 'A shell.' });
  });

  it('reads an unknown needs value or role as needs user', () => {
    for (const value of ['coffee', 'role:astronaut', 'role:']) {
      const closing = parseChildClosing({
        text: `<<step-done id="${ID}" status="returned" needs="${value}">>\nHelp.`,
        childAgentId: ID,
      });
      expect(closing.returned?.needs, value).toEqual({ kind: 'user' });
    }
  });

  it('takes the request from the line before the closing when none follows', () => {
    const closing = parseChildClosing({
      text: `Report body.\n\nI need the shell to list commits.\n<<step-done id="${ID}" status="returned" needs="shell">>\n`,
      childAgentId: ID,
    });
    expect(closing.returned?.request).toBe('I need the shell to list commits.');
  });

  it('never takes a line of the report block as the request', () => {
    const closing = parseChildClosing({
      text: `Read two files.\n<<artifact v=1 kind=report>>\n{"title":"Callers","format":"markdown","content":"x"}\n<</artifact>>\n<<step-done id="${ID}" status="returned" needs="shell">>`,
      childAgentId: ID,
    });
    expect(closing.returned?.request).toBe('Read two files.');
  });

  it('reads no return on a done closing', () => {
    const closing = parseChildClosing({
      text: `All good.\n<<step-done id="${ID}">>`,
      childAgentId: ID,
    });
    expect(closing.returned).toBeNull();
  });

  it('reads a closing line whose id a model wrapped across lines', () => {
    const closing = parseChildClosing({
      text: 'Nothing to add.\n<<step-done id="agent-sco\n\nut-1">>',
      childAgentId: ID,
    });
    expect(closing.completion).toBe('done');
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

  it('still reads a return and a question from the dropped middle of a long reply', () => {
    const filler = 'y'.repeat(3_000);
    const returned = parseChildClosing({
      text: `${filler}\n<<step-done id="${ID}" status="returned" needs="shell">>\n${filler}`,
      childAgentId: ID,
    });
    expect(returned.completion).toBe('blocked');
    expect(returned.returned?.needs).toEqual({ kind: 'shell' });
    expect(returned.summary).toContain('middle dropped');
    const asked = parseChildClosing({
      text: `${filler}\n<<ctx-question blocking="true">>Which branch?<</ctx-question>>\n${filler}\n<<step-done id="${ID}">>`,
      childAgentId: ID,
    });
    expect(asked.question?.text).toBe('Which branch?');
    expect(asked.summary).toContain('middle dropped');
  });

  it('lets the first closing line win over a later one', () => {
    const doneFirst = parseChildClosing({
      text: `All good.\n<<step-done id="${ID}">>\n<<step-done id="${ID}" status="returned" needs="shell">>\nA shell.`,
      childAgentId: ID,
    });
    expect(doneFirst).toMatchObject({ completion: 'done', returned: null });
    const returnFirst = parseChildClosing({
      text: `Half done.\n<<step-done id="${ID}" status="returned" needs="writer">>\nChange the file.\n<<step-done id="${ID}">>`,
      childAgentId: ID,
    });
    expect(returnFirst.completion).toBe('blocked');
    expect(returnFirst.returned).toEqual({
      needs: { kind: 'writer' },
      request: 'Change the file.',
    });
  });

  it('drops a blocking question from a reply that returns', () => {
    const closing = parseChildClosing({
      text: `<<ctx-question blocking="true">>Which branch?<</ctx-question>>\n<<step-done id="${ID}" status="returned" needs="decision">>\nPick the branch for ledger-core.`,
      childAgentId: ID,
    });
    expect(closing.question).toBeNull();
    expect(closing.returned).toEqual({
      needs: { kind: 'decision' },
      request: 'Pick the branch for ledger-core.',
    });
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
