import { describe, expect, it, vi } from 'vitest';
import { buildIssueBriefUserPrompt, generateIssueBrief, parseIssueBrief } from './issue-brief';

const INPUT = {
  identifier: 'ACME-412',
  title: 'Checkout fails when the promo code field is empty',
  body: 'Paying with an empty promo code calls applyPromo and returns 422.',
};

const BRIEF_JSON = JSON.stringify({
  title: 'Fix checkout when the promo code is empty',
  goal: 'Paying with an empty promo code must go through without calling applyPromo.',
  acceptance: ['Empty promo field pays normally', 'Invalid code still shows the inline error'],
});

const stdoutFor = (result: string) => JSON.stringify({ result });

describe('parseIssueBrief', () => {
  it('reads title, goal and acceptance from a bare JSON object', () => {
    expect(parseIssueBrief({ text: BRIEF_JSON })).toEqual({
      kind: 'ready',
      brief: {
        title: 'Fix checkout when the promo code is empty',
        goal: 'Paying with an empty promo code must go through without calling applyPromo.',
        acceptance: [
          'Empty promo field pays normally',
          'Invalid code still shows the inline error',
        ],
      },
    });
  });

  it('accepts a fence that wraps only the object', () => {
    expect(parseIssueBrief({ text: `\`\`\`json\n${BRIEF_JSON}\n\`\`\`` }).kind).toBe('ready');
  });

  it('accepts an uppercase language tag and a bare fence', () => {
    expect(parseIssueBrief({ text: `\`\`\`JSON\n${BRIEF_JSON}\n\`\`\`` }).kind).toBe('ready');
    expect(parseIssueBrief({ text: `\`\`\`\n${BRIEF_JSON}\n\`\`\`` }).kind).toBe('ready');
  });

  it('answers quickly on a long run of whitespace inside a fence', () => {
    const started = performance.now();
    parseIssueBrief({ text: `\`\`\`${' '.repeat(50_000)}x` });
    expect(performance.now() - started).toBeLessThan(200);
  });

  it('rejects an answer with a preamble', () => {
    expect(
      parseIssueBrief({ text: `Ecco il brief rivisto:\n\`\`\`json\n${BRIEF_JSON}\n\`\`\`` }),
    ).toEqual({ kind: 'failed', failure: 'not_json' });
  });

  it('rejects an empty answer', () => {
    expect(parseIssueBrief({ text: '  ' })).toEqual({ kind: 'failed', failure: 'empty_answer' });
  });

  it('names the missing title and the missing goal', () => {
    expect(parseIssueBrief({ text: JSON.stringify({ goal: 'Ship it.' }) })).toEqual({
      kind: 'failed',
      failure: 'missing_title',
    });
    expect(parseIssueBrief({ text: JSON.stringify({ title: 'Ship it' }) })).toEqual({
      kind: 'failed',
      failure: 'missing_goal',
    });
  });

  it('keeps at most five criteria on one line each and drops empty ones', () => {
    const parsed = parseIssueBrief({
      text: JSON.stringify({
        title: 'Ship\nit',
        goal: 'Ship it.',
        acceptance: ['one', '', 'two\nlines', 'three', 'four', 'five', 'six', 42],
      }),
    });
    expect(parsed).toEqual({
      kind: 'ready',
      brief: {
        title: 'Ship it',
        goal: 'Ship it.',
        acceptance: ['one', 'two lines', 'three', 'four', 'five'],
      },
    });
  });
});

describe('buildIssueBriefUserPrompt', () => {
  it('carries the identifier, the title and the whole text', () => {
    const prompt = buildIssueBriefUserPrompt(INPUT);
    expect(prompt).toContain('IDENTIFIER: ACME-412');
    expect(prompt).toContain(`TITLE: ${INPUT.title}`);
    expect(prompt).toContain(INPUT.body);
  });
});

describe('generateIssueBrief', () => {
  it('runs the resolved task model and times the answer', async () => {
    const invokeFn = vi
      .fn()
      .mockResolvedValue({ stdout: stdoutFor(BRIEF_JSON), stderr: '', exitCode: 0 });
    const clock = vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(4_200);

    const result = await generateIssueBrief({
      deps: { providerId: 'anthropic', model: 'haiku-4.5', invokeFn, nowMs: clock },
      input: INPUT,
    });

    expect(result.kind).toBe('ready');
    expect(result.kind === 'ready' ? result.durationMs : null).toBe(3_200);
    expect(invokeFn).toHaveBeenCalledWith(
      'summarize_session',
      expect.objectContaining({
        args: expect.objectContaining({
          systemPrompt: expect.stringContaining('language of the item'),
        }),
      }),
    );
  });

  it('reports a provider failure with its stderr', async () => {
    const invokeFn = vi.fn().mockResolvedValue({ stdout: '', stderr: 'boom', exitCode: 1 });

    await expect(
      generateIssueBrief({
        deps: { providerId: 'anthropic', model: 'haiku-4.5', invokeFn },
        input: INPUT,
      }),
    ).resolves.toEqual({ kind: 'failed', failure: 'provider_failed', detail: 'boom' });
  });

  it('reports a thrown spawn as a provider failure', async () => {
    const invokeFn = vi.fn().mockRejectedValue(new Error('spawn failed'));

    await expect(
      generateIssueBrief({
        deps: { providerId: 'anthropic', model: 'haiku-4.5', invokeFn },
        input: INPUT,
      }),
    ).resolves.toEqual({ kind: 'failed', failure: 'provider_failed', detail: 'spawn failed' });
  });

  it('refuses free prose in place of the JSON object', async () => {
    const invokeFn = vi.fn().mockResolvedValue({
      stdout: stdoutFor('Here is the brief you asked for.'),
      stderr: '',
      exitCode: 0,
    });

    await expect(
      generateIssueBrief({
        deps: { providerId: 'anthropic', model: 'haiku-4.5', invokeFn },
        input: INPUT,
      }),
    ).resolves.toEqual({ kind: 'failed', failure: 'not_json', detail: null });
  });
});
