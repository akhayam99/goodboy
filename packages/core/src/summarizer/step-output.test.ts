import { describe, expect, it } from 'vitest';
import type { SummarizerDeps } from './client';
import { SummarizerParseError } from './client';
import {
  annotateFallbackStepOutputSummary,
  fallbackStepOutputSummary,
  isFallbackStepOutputSummary,
  previewStepOutputSummary,
  summarizeStepOutput,
} from './step-output';

describe('summarizeStepOutput', () => {
  it('uses the summarizer invoke channel and dedicated handoff prompt', async () => {
    let command = '';
    let request: Record<string, unknown> | undefined;
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(
      cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      command = cmd;
      request = args;
      return { stdout: 'Implemented auth flow.\n- `src/auth.ts`', stderr: '', exitCode: 0 } as T;
    };

    const result = await summarizeStepOutput({
      providerId: 'cursor',
      model: 'sonnet-4.6',
      invokeFn,
      output: 'raw',
    });
    const args = request?.['args'];
    const cliModel =
      typeof args === 'object' && args !== null && 'model' in args ? args.model : null;
    const systemPrompt =
      typeof args === 'object' && args !== null && 'systemPrompt' in args
        ? args.systemPrompt
        : null;

    expect(command).toBe('summarize_session');
    expect(cliModel).toBe('claude-4.6-sonnet-medium');
    expect(systemPrompt).toContain('File paths touched');
    expect(systemPrompt).toContain('1200 characters or fewer');
    expect(result).toBe('Implemented auth flow.\n- `src/auth.ts`');
  });

  it('carries the cancellation handle down to the spawn boundary', async () => {
    let request: Record<string, unknown> | undefined;
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(
      _cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      request = args;
      return { stdout: 'Done.', stderr: '', exitCode: 0 } as T;
    };

    await summarizeStepOutput({
      providerId: 'cursor',
      model: 'sonnet-4.6',
      invokeFn,
      output: 'raw',
      runId: 'summary-run-1',
    });

    expect(request?.['args']).toMatchObject({ runId: 'summary-run-1' });
  });

  it('tells the summarizer what the next step expects when the step declares it', async () => {
    let request: Record<string, unknown> | undefined;
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(
      _cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      request = args;
      return { stdout: 'Mapped the area.', stderr: '', exitCode: 0 } as T;
    };

    await summarizeStepOutput({
      providerId: 'cursor',
      model: 'composer-2-fast',
      invokeFn,
      output: 'raw',
      expectedOutput: 'An ordered per-file refactor plan.',
    });
    const args = request?.['args'];
    const systemPrompt =
      typeof args === 'object' && args !== null && 'systemPrompt' in args
        ? String(args.systemPrompt)
        : '';

    expect(systemPrompt).toContain('An ordered per-file refactor plan.');
    expect(systemPrompt).toContain('File paths touched');
  });

  it('bounds long output before invoking the summarizer and preserves its end', async () => {
    let request: Record<string, unknown> | undefined;
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(
      _cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      request = args;
      return { stdout: 'Bounded the handoff input.', stderr: '', exitCode: 0 } as T;
    };
    const output = `${'h'.repeat(130_000)}TAIL_BLOCKER`;

    await summarizeStepOutput({
      providerId: 'cursor',
      model: 'composer-2-fast',
      invokeFn,
      output,
    });
    const args = request?.['args'];
    const userMessage =
      typeof args === 'object' && args !== null && 'userMessage' in args
        ? String(args.userMessage)
        : '';

    expect(userMessage.length).toBe(120_000);
    expect(userMessage.startsWith('h'.repeat(100_000))).toBe(true);
    expect(userMessage).toContain('middle output omitted to fit the summarizer input budget');
    expect(userMessage.endsWith('TAIL_BLOCKER')).toBe(true);
  });

  it('parses the anthropic result envelope', async () => {
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return {
        stdout: JSON.stringify({ result: 'Review passed.\n- No blockers' }),
        stderr: '',
        exitCode: 0,
      } as T;
    };

    await expect(
      summarizeStepOutput({
        providerId: 'anthropic',
        model: 'claude-haiku-4-5',
        invokeFn,
        output: 'raw review',
      }),
    ).resolves.toBe('Review passed.\n- No blockers');
  });

  it('accepts a summary whose outcome line runs past its requested budget', async () => {
    const summary = 'x'.repeat(121);
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return { stdout: summary, stderr: '', exitCode: 0 } as T;
    };

    await expect(
      summarizeStepOutput({
        providerId: 'cursor',
        model: 'composer-2-fast',
        invokeFn,
        output: 'raw',
      }),
    ).resolves.toBe(summary);
  });

  it.each([101, 109, 111, 129, 132, 148])(
    'accepts a measured outcome line of %i characters',
    async (firstLineLength) => {
      const summary = `${'x'.repeat(firstLineLength)}\n- Preserved detail`;
      const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
        return { stdout: summary, stderr: '', exitCode: 0 } as T;
      };

      await expect(
        summarizeStepOutput({
          providerId: 'cursor',
          model: 'composer-2-fast',
          invokeFn,
          output: 'raw',
        }),
      ).resolves.toBe(summary);
    },
  );

  it('rejects an empty summary', async () => {
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return { stdout: '   \n  ', stderr: '', exitCode: 0 } as T;
    };

    await expect(
      summarizeStepOutput({
        providerId: 'cursor',
        model: 'composer-2-fast',
        invokeFn,
        output: 'raw',
      }),
    ).rejects.toBeInstanceOf(SummarizerParseError);
  });

  it('keeps a summary that lands exactly on the budget', async () => {
    const exact = `ok\n${'x'.repeat(1197)}`;
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return { stdout: exact, stderr: '', exitCode: 0 } as T;
    };

    await expect(
      summarizeStepOutput({
        providerId: 'cursor',
        model: 'composer-2-fast',
        invokeFn,
        output: 'raw',
      }),
    ).resolves.toBe(exact);
  });

  it('clamps an over-budget summary on a line boundary and says it clamped', async () => {
    const outcome = 'Wired the workflow handoff.';
    const bullets = Array.from(
      { length: 40 },
      (_value, index) => `- note ${index}: ${'d'.repeat(40)}`,
    );
    const overBudget = [outcome, ...bullets].join('\n');
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return { stdout: overBudget, stderr: '', exitCode: 0 } as T;
    };

    const result = await summarizeStepOutput({
      providerId: 'cursor',
      model: 'composer-2-fast',
      invokeFn,
      output: 'raw',
    });
    const notice =
      '(clamped to the handoff budget, the full step output is in the step transcript)';
    const kept = result.slice(0, result.length - notice.length).trimEnd();

    expect(overBudget.length).toBeGreaterThan(1200);
    expect(result.length).toBeLessThanOrEqual(1200);
    expect(result.endsWith(notice)).toBe(true);
    expect(kept.startsWith(outcome)).toBe(true);
    expect(kept).toContain(bullets[0]);
    expect(kept).not.toContain(bullets[39]);
    expect(kept.split('\n').every((line) => overBudget.split('\n').includes(line))).toBe(true);
  });

  it('bounds a first line that alone exceeds the summary budget', async () => {
    const overBudget = 'x'.repeat(1300);
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return { stdout: overBudget, stderr: '', exitCode: 0 } as T;
    };

    const result = await summarizeStepOutput({
      providerId: 'cursor',
      model: 'composer-2-fast',
      invokeFn,
      output: 'raw',
    });

    expect(result.length).toBeLessThanOrEqual(1200);
    expect(result).toContain('clamped to the handoff budget');
  });
});

describe('fallbackStepOutputSummary', () => {
  const paragraph = (index: number): string =>
    `Paragraph ${index} touched src/module-${index}.ts and left the suite green. ${'filler words here '.repeat(12)}`.trim();
  const longOutput = [
    ...Array.from({ length: 30 }, (_value, index) => paragraph(index)),
    'Blocker: the migration lock is still held by the previous run.',
  ].join('\n\n');

  it('carries a short output whole under a reserved first line', () => {
    const result = fallbackStepOutputSummary({ output: 'short outcome' });

    expect(result.split('\n')[0]).toBe('[unsummarized step output, carried whole]');
    expect(result.endsWith('short outcome')).toBe(true);
    expect(isFallbackStepOutputSummary({ summary: result })).toBe(true);
  });

  it('marks an empty output as nothing captured', () => {
    const result = fallbackStepOutputSummary({ output: '   \n ' });

    expect(result).toBe('[unsummarized step output, no output captured]');
    expect(isFallbackStepOutputSummary({ summary: result })).toBe(true);
  });

  it('keeps whole head and tail passages inside the handoff budget', () => {
    const result = fallbackStepOutputSummary({ output: longOutput });

    expect(result.length).toBeLessThanOrEqual(4000);
    expect(result.split('\n')[0]).toBe('[unsummarized step output, excerpt]');
    expect(result).toContain('[middle dropped, the full text is in the step transcript]');
    expect(result).toContain(paragraph(0));
    expect(result).not.toContain(paragraph(15));
    expect(isFallbackStepOutputSummary({ summary: result })).toBe(true);
  });

  it('keeps a blocker sentence sitting at the very end', () => {
    const result = fallbackStepOutputSummary({ output: longOutput });

    expect(result.endsWith('Blocker: the migration lock is still held by the previous run.')).toBe(
      true,
    );
  });

  it('splits a token only when one token alone cannot fit', () => {
    const result = fallbackStepOutputSummary({ output: 'x'.repeat(12_000) });

    expect(result.length).toBeLessThanOrEqual(4000);
    expect(result.split('\n')[0]).toBe('[unsummarized step output, excerpt]');
  });

  it('still detects a legacy 1905 character signature', () => {
    const legacy = `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`;

    expect(legacy.length).toBe(1905);
    expect(isFallbackStepOutputSummary({ summary: legacy })).toBe(true);
  });

  it('does not read an ordinary summary as a fallback', () => {
    expect(isFallbackStepOutputSummary({ summary: 'short\n...\nsummary' })).toBe(false);
    expect(isFallbackStepOutputSummary({ summary: 'Wired the handoff.\n- `src/auth.ts`' })).toBe(
      false,
    );
  });
});

describe('annotateFallbackStepOutputSummary', () => {
  it('labels a legacy fallback that carries no marker of its own', () => {
    const legacy = `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`;

    const annotated = annotateFallbackStepOutputSummary({ summary: legacy });

    expect(annotated.split('\n')[0]).toBe('[unsummarized step output, legacy excerpt]');
    expect(annotated.endsWith(legacy)).toBe(true);
  });

  it('leaves a marked fallback and an ordinary summary untouched', () => {
    const marked = fallbackStepOutputSummary({ output: 'short outcome' });

    expect(annotateFallbackStepOutputSummary({ summary: marked })).toBe(marked);
    expect(annotateFallbackStepOutputSummary({ summary: 'Wired the handoff.' })).toBe(
      'Wired the handoff.',
    );
  });
});

describe('previewStepOutputSummary', () => {
  it('keeps the marker in front of a previewed fallback', () => {
    const marked = fallbackStepOutputSummary({ output: 'a'.repeat(9000) });

    const preview = previewStepOutputSummary({ summary: marked, length: 80 });

    expect(preview.startsWith('[unsummarized step output, excerpt] ')).toBe(true);
    expect(isFallbackStepOutputSummary({ summary: preview })).toBe(true);
  });

  it('previews an ordinary summary by plain length', () => {
    expect(previewStepOutputSummary({ summary: 'abcdef', length: 3 })).toBe('abc');
  });
});

describe('preview length with a marker', () => {
  it('never runs past the requested length when a fallback is marked', () => {
    const fallback = fallbackStepOutputSummary({ output: 'paragraph of filler.\n\n'.repeat(600) });
    for (const length of [12, 40, 120, 280]) {
      expect(previewStepOutputSummary({ summary: fallback, length }).length).toBeLessThanOrEqual(
        length,
      );
    }
  });

  it('never runs past the requested length for a legacy fallback', () => {
    const body = 'x'.repeat(9000);
    const legacy = `${body.slice(0, 1500)}\n...\n${body.slice(-400)}`;
    expect(previewStepOutputSummary({ summary: legacy, length: 280 }).length).toBeLessThanOrEqual(
      280,
    );
  });
});
