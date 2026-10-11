import { describe, expect, it, vi } from 'vitest';
import { buildIssueBriefUserPrompt, generateIssueBrief, parseIssueBrief } from './issue-brief';

const ITEM = {
  identifier: 'ACME-412',
  title: 'Checkout fails when the promo code field is empty',
  body: 'Paying with an empty promo code calls applyPromo and returns 422.',
};

const INPUT = { items: [ITEM] };

const BRIEF_JSON = JSON.stringify({
  title: 'Fix checkout when the promo code is empty',
  goal: 'Paying with an empty promo code must go through without calling applyPromo.',
  acceptance: ['Empty promo field pays normally', 'Invalid code still shows the inline error'],
});

type Params = { readonly result: string };

const stdoutFor = ({ result }: Params) => JSON.stringify({ result });

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

  it('does not read a brief out of a long run of whitespace inside a fence', () => {
    expect(parseIssueBrief({ text: `\`\`\`${' '.repeat(50_000)}x` })).toEqual({
      kind: 'failed',
      failure: 'not_json',
    });
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
  it('keeps the start flow prompt for one item', () => {
    expect(buildIssueBriefUserPrompt(INPUT)).toBe(
      [
        'IDENTIFIER: ACME-412',
        `TITLE: ${ITEM.title}`,
        '',
        'TEXT:',
        ITEM.body,
        '',
        'Write the brief following your instructions. Output only the JSON object.',
      ].join('\n'),
    );
  });

  it('names both items and requests one title and goal covering them', () => {
    const prompt = buildIssueBriefUserPrompt({ items: [ITEM, { ...ITEM, identifier: 'HL-211' }] });
    expect(prompt).toContain('IDENTIFIER: ACME-412');
    expect(prompt).toContain('IDENTIFIER: HL-211');
    expect(prompt).toContain('one title of at most 60 characters');
    expect(prompt).toContain('one goal of one to three sentences covering all items');
  });

  it.each(['', '   '])('marks an empty body as title only: %j', (body) => {
    expect(buildIssueBriefUserPrompt({ items: [{ ...ITEM, body }] })).toContain('title only');
  });

  it('carries fenced issue text as data', () => {
    const body = '```typescript\nconst value = 1;\n```';
    expect(buildIssueBriefUserPrompt({ items: [{ ...ITEM, body }] })).toContain(body);
  });

  it('handles a 100k body without dropping its text', () => {
    const body = 'a'.repeat(100_000);
    expect(buildIssueBriefUserPrompt({ items: [{ ...ITEM, body }] })).toContain(body);
  });

  it.each([0, 6])('rejects %i items before invoking a model', async (count) => {
    const invokeFn = vi.fn();
    const input = { items: Array.from({ length: count }, () => ITEM) };
    expect(() => buildIssueBriefUserPrompt(input)).toThrow('one to five');
    expect(
      (
        await generateIssueBrief({
          input,
          deps: { providerId: 'anthropic', model: 'haiku-4.5', invokeFn },
        })
      ).kind,
    ).toBe('failed');
    expect(invokeFn).not.toHaveBeenCalled();
  });
});

describe('generateIssueBrief', () => {
  it('runs the resolved task model and times the answer', async () => {
    const invokeFn = vi
      .fn()
      .mockResolvedValue({ stdout: stdoutFor({ result: BRIEF_JSON }), stderr: '', exitCode: 0 });
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
      stdout: stdoutFor({ result: 'Here is the brief you asked for.' }),
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
