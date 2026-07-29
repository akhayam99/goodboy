import { describe, expect, it } from 'vitest';
import type { SummarizerDeps } from './client';
import { SummarizerParseError } from './client';
import {
  fallbackStepOutputSummary,
  isFallbackStepOutputSummary,
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

  it('rejects summaries that violate the output contract', async () => {
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(): Promise<T> => {
      return { stdout: 'x'.repeat(121), stderr: '', exitCode: 0 } as T;
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
});

describe('fallbackStepOutputSummary', () => {
  it('keeps short output and joins the exact long-output head and tail', () => {
    const longOutput = `${'h'.repeat(1500)}middle${'t'.repeat(400)}`;
    const fallback = `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`;

    expect(fallbackStepOutputSummary({ output: 'short' })).toBe('short');
    expect(fallbackStepOutputSummary({ output: longOutput })).toBe(fallback);
    expect(isFallbackStepOutputSummary({ summary: fallback })).toBe(true);
    expect(isFallbackStepOutputSummary({ summary: 'short\n...\nsummary' })).toBe(false);
  });
});
