import { describe, expect, it } from 'vitest';
import { Summarizer, type SummarizerDeps } from './client';
import { SUMMARIZER_SYSTEM_PROMPT } from './prompt';

describe('Summarizer client prompt', () => {
  it('defines cumulative session summary, compaction, decisions, and goal rules', async () => {
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
      '- goal: 280\n- files_touched: 1600\n- decisions: 1200\n- open_questions: 800\n- last_output_summary: 900\n\nIf a current or updated slot exceeds its budget, emit a compacted full value within the budget. Merge semantic duplicates, replace superseded decisions with the final decision, and keep the most recent and most relevant facts.',
    );
    expect(systemPrompt).toContain(
      'When a new decision reverses or supersedes an earlier one, REPLACE the earlier entry with the final decision.',
    );
    expect(systemPrompt).toContain(
      'On every turn, REWORK the previous summary together with the latest assistant turn into a new summary covering what the session has accomplished so far, the current state, and what is in flight.',
    );
    expect(systemPrompt).toContain(
      'Never exceed two sentences. If the current value exceeds two sentences, rewrite it down to two sentences or fewer.',
    );
  });
});
