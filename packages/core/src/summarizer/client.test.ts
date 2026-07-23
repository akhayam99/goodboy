import { describe, expect, it } from 'vitest';
import { Summarizer, type SummarizerDeps } from './client';
import { SUMMARIZER_SYSTEM_PROMPT } from './prompt';

describe('Summarizer client prompt', () => {
  it('defines structured summary, compaction, decisions, and goal rules', async () => {
    let request: Record<string, unknown> | undefined;
    const invokeFn: SummarizerDeps['invokeFn'] = async <T>(
      _cmd: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      request = args;
      throw new Error('prompt captured');
    };
    const summarizer = new Summarizer({ providerId: 'cursor', invokeFn });

    await summarizer
      .summarize({ prevSlots: [], turnInput: 'q', turnOutput: 'a' })
      .catch(() => undefined);

    if (request == null) {
      throw new Error('missing summarizer request');
    }
    const args = request['args'];
    if (typeof args !== 'object' || args === null || !('systemPrompt' in args)) {
      throw new Error('missing summarizer system prompt');
    }
    const systemPrompt = args.systemPrompt;
    if (typeof systemPrompt !== 'string') {
      throw new Error('invalid summarizer system prompt');
    }

    expect(systemPrompt).toBe(SUMMARIZER_SYSTEM_PROMPT);
    expect(systemPrompt).toContain('- last_output_summary (session summary)');
    expect(systemPrompt).toContain(
      '- goal: 280\n- files_touched: 1600\n- decisions: 1200\n- open_questions: 800\n- last_output_summary: 2000\n\nIf a current or updated slot exceeds its budget, emit a compacted full value within the budget. Merge semantic duplicates, replace superseded decisions with the final decision, and keep the most recent and most relevant facts.',
    );
    expect(systemPrompt).toContain(
      'For last_output_summary, compaction MUST preserve all four bold section labels; compress the content within each section, never drop a section.',
    );
    expect(systemPrompt).toContain(
      'Per-slot format rules override these general rules: last_output_summary follows its four-section format above, and its Problem section is sentences, not bullets.',
    );
    expect(systemPrompt).toContain(
      'A newer decision that reverses or contradicts an earlier one REPLACES it, so the emitted set must never contain two entries that contradict each other.',
    );
    expect(systemPrompt).toContain(
      'when this slot changes, emit the ENTIRE set rewritten compactly, one line per decision',
    );
    expect(systemPrompt).toContain(
      'a standard structured object with four fixed sections, in this exact order, each introduced by a bold label: `**Problem:**`, `**Learned:**`, `**State:**`, `**Next:**`',
    );
    expect(systemPrompt).toContain(
      '**Problem:** why the session exists, the original problem or request, in one or two sentences. Sticky: write it once, then only sharpen or compress it.',
    );
    expect(systemPrompt).toContain(
      '**Learned:** durable discoveries that changed the understanding or approach',
    );
    expect(systemPrompt).toContain(
      '**State:** where the work is right now. Fully rewritten every pass.',
    );
    expect(systemPrompt).toContain(
      '**Next:** what remains and what is in flight. Fully rewritten every pass.',
    );
    expect(systemPrompt).toContain(
      'Never exceed two sentences. If the current value exceeds two sentences, rewrite it down to two sentences or fewer.',
    );
  });
});
