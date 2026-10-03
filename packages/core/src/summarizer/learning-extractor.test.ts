import { describe, expect, it, vi } from 'vitest';
import {
  LearningExtractor,
  LearningExtractorError,
  parseLearningCandidates,
} from './learning-extractor';

const TOPICS = ['Rust', 'Database migrations'];

const answer = (items: ReadonlyArray<Record<string, unknown>>) => JSON.stringify({ items });

const BORROW = {
  topic: 'rust',
  title: 'Why the borrow checker rejects holding the retry queue across an await',
  text: 'The queue guard lives until the end of the block, so the task still borrows it while suspended. Drop the guard before the await.',
};

describe('parseLearningCandidates', () => {
  it('keeps an explained topic and spells it as the person did', () => {
    expect(parseLearningCandidates({ raw: answer([BORROW]), topics: TOPICS })).toEqual([
      { ...BORROW, topic: 'Rust' },
    ]);
  });

  it('returns nothing when no topic was explained', () => {
    expect(parseLearningCandidates({ raw: answer([]), topics: TOPICS })).toEqual([]);
  });

  it('drops items on a topic the person never listed, and blank ones', () => {
    const items = [
      { topic: 'Kubernetes', title: 'Pods', text: 'A pod is a group of containers.' },
      { topic: 'Rust', title: '  ', text: 'x' },
      { topic: 'Rust', title: 'Lifetimes', text: '' },
      { topic: 'Rust', title: 3, text: 'x' },
    ];
    expect(parseLearningCandidates({ raw: answer(items), topics: TOPICS })).toEqual([]);
  });

  it('drops duplicates and keeps at most three', () => {
    const items = [
      BORROW,
      { ...BORROW, title: BORROW.title.toUpperCase() },
      { topic: 'Rust', title: 'Send and Sync on the client', text: 'Rc is not Send.' },
      { topic: 'Database migrations', title: 'Backfill in batches', text: 'Locks stay short.' },
      { topic: 'Rust', title: 'Arc or a reference', text: 'Clone when the task keeps it.' },
    ];
    const parsed = parseLearningCandidates({ raw: answer(items), topics: TOPICS });
    expect(parsed.map((item) => item.title)).toEqual([
      BORROW.title,
      'Send and Sync on the client',
      'Backfill in batches',
    ]);
  });

  it('throws on an answer that is not the JSON object', () => {
    expect(() => parseLearningCandidates({ raw: 'Sure, here you go', topics: TOPICS })).toThrow(
      LearningExtractorError,
    );
    expect(() => parseLearningCandidates({ raw: '{"list": []}', topics: TOPICS })).toThrow(
      'missing "items"',
    );
  });
});

describe('LearningExtractor', () => {
  it('sends the topics and the turn and returns the items with their usage', async () => {
    const invokeFn = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({ result: answer([BORROW]), subtype: 'success' }),
      stderr: '',
      exitCode: 0,
    });
    const extractor = new LearningExtractor({ providerId: 'anthropic', invokeFn });

    const result = await extractor.extract({
      topics: TOPICS,
      turnInput: 'Why does this fail to compile?',
      turnOutput: BORROW.text,
    });

    expect(result.items).toEqual([{ ...BORROW, topic: 'Rust' }]);
    const [, args] = invokeFn.mock.calls[0] ?? [];
    const { userMessage } = (args as { readonly args: { readonly userMessage: string } }).args;
    expect(userMessage).toContain('Topics: Rust, Database migrations');
    expect(userMessage).toContain('Why does this fail to compile?');
  });

  it('fails when the CLI exits with an error', async () => {
    const invokeFn = vi.fn().mockResolvedValue({ stdout: '', stderr: 'boom', exitCode: 1 });
    const extractor = new LearningExtractor({ providerId: 'anthropic', invokeFn });

    await expect(
      extractor.extract({ topics: TOPICS, turnInput: 'a', turnOutput: 'b' }),
    ).rejects.toThrow('exited with code 1');
  });
});
