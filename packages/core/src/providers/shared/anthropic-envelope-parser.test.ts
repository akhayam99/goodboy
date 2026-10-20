import { beforeEach, describe, expect, it } from 'vitest';
import type { IsoDateTime, TurnEvent } from '@goodboy/types';
import { nextProviderRunId } from '@goodboy/types/testing';
import { parseAnthropicEnvelopeLine, type ParseContext } from './anthropic-envelope-parser';
import { resetTextBoundary } from './text-boundary';

const isIsoDateTime = (value: string): value is IsoDateTime => !Number.isNaN(Date.parse(value));

const isoAt = ({ value }: { readonly value: string }): IsoDateTime => {
  if (!isIsoDateTime(value)) {
    throw new Error(`not a date: ${value}`);
  }
  return value;
};

const at = isoAt({ value: '2026-05-07T00:00:00.000Z' });
const RUN_ID = nextProviderRunId();
const OPTS = { adapter: 'anthropic', logTag: 'claude-adapter' } as const;

const makeCtx = (): ParseContext => ({ runId: RUN_ID, now: () => at });

type Feed = {
  readonly ctx: ParseContext;
  readonly feed: (payload: unknown) => ReadonlyArray<TurnEvent>;
};

const makeFeed = (): Feed => {
  const ctx = makeCtx();
  return {
    ctx,
    feed: (payload) => parseAnthropicEnvelopeLine(JSON.stringify(payload), ctx, OPTS),
  };
};

const delta = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'stream_event',
  event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  parent_tool_use_id: null,
  ...extra,
});

const blockStart = (index: number) => ({
  type: 'stream_event',
  event: { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
  parent_tool_use_id: null,
});

const blockStop = (index: number) => ({
  type: 'stream_event',
  event: { type: 'content_block_stop', index },
  parent_tool_use_id: null,
});

const messageStart = (id: string) => ({
  type: 'stream_event',
  event: { type: 'message_start', message: { id } },
  parent_tool_use_id: null,
});

const assistantText = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'assistant',
  message: { id: 'msg_1', content: [{ type: 'text', text }] },
  ...extra,
});

const textOf = (events: ReadonlyArray<TurnEvent>): string =>
  events.map((event) => (event.kind === 'assistant_text' ? event.delta : '')).join('');

describe('claude partial messages', () => {
  beforeEach(() => {
    resetTextBoundary({ runId: RUN_ID });
  });

  it('turns every text delta into one assistant_text event', () => {
    const { feed } = makeFeed();
    feed(messageStart('msg_1'));
    feed(blockStart(0));
    expect(feed(delta('Hello'))).toEqual([
      { kind: 'assistant_text', runId: RUN_ID, delta: 'Hello', at, isPartial: true },
    ]);
    expect(feed(delta(' world'))).toEqual([
      { kind: 'assistant_text', runId: RUN_ID, delta: ' world', at, isPartial: true },
    ]);
  });

  it('drops the whole block that follows a streamed one, so nothing is written twice', () => {
    const { feed } = makeFeed();
    feed(messageStart('msg_1'));
    feed(blockStart(0));
    const streamed = [feed(delta('Hello')), feed(delta(' world'))].flat();
    feed(blockStop(0));
    expect(feed(assistantText('Hello world'))).toEqual([]);
    expect(textOf(streamed)).toBe('Hello world');
  });

  it('keeps the usage of the whole assistant line while dropping its text', () => {
    const { feed, ctx } = makeFeed();
    feed(messageStart('msg_1'));
    feed(delta('Hello'));
    feed(
      assistantText('Hello', {
        message: {
          id: 'msg_1',
          content: [{ type: 'text', text: 'Hello' }],
          usage: { input_tokens: 10, output_tokens: 4 },
        },
      }),
    );
    expect(ctx.lastAssistantContextTokens).toBe(14);
  });

  it('separates a second streamed block from the first by a blank line', () => {
    const { feed } = makeFeed();
    feed(messageStart('msg_1'));
    feed(blockStart(0));
    const first = feed(delta('Reading the file.'));
    feed(blockStop(0));
    feed(assistantText('Reading the file.'));
    feed(parseToolUse());
    feed(blockStart(0));
    const second = feed(delta('Found it.'));
    expect(textOf(first)).toBe('Reading the file.');
    expect(textOf(second)).toBe('\n\nFound it.');
  });

  it('writes a block that was never streamed, as before', () => {
    const { feed } = makeFeed();
    expect(textOf(feed(assistantText('Whole block')))).toBe('Whole block');
  });

  it('keeps the whole text of a block whose deltas were different', () => {
    const { feed } = makeFeed();
    feed(messageStart('msg_1'));
    feed(delta('Hello'));
    expect(textOf(feed(assistantText('Something else')))).toBe('\n\nSomething else');
  });

  it('forgets the streamed text of a finished turn', () => {
    const { feed } = makeFeed();
    feed(messageStart('msg_1'));
    feed(delta('Done.'));
    feed({ type: 'result', subtype: 'success', usage: {} });
    resetTextBoundary({ runId: RUN_ID });
    expect(textOf(feed(assistantText('Done.')))).toBe('Done.');
  });

  it('ignores deltas of a nested agent and every non text stream event', () => {
    const { feed } = makeFeed();
    expect(feed(delta('inner', { parent_tool_use_id: 'toolu_1' }))).toEqual([]);
    expect(
      feed({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: '{' },
        },
      }),
    ).toEqual([]);
    expect(
      feed({
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hm' } },
      }),
    ).toEqual([]);
    expect(
      feed({ type: 'stream_event', event: { type: 'message_delta', delta: {}, usage: {} } }),
    ).toEqual([]);
  });

  it('never reports a stream event as an unknown payload', () => {
    const { feed } = makeFeed();
    expect(feed({ type: 'stream_event', event: { type: 'message_stop' } })).toEqual([]);
  });
});

const parseToolUse = () => ({
  type: 'assistant',
  message: {
    id: 'msg_1',
    content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'a.ts' } }],
  },
});

describe('cursor partial output', () => {
  beforeEach(() => {
    resetTextBoundary({ runId: RUN_ID });
  });

  it('writes the timestamped lines as deltas and drops the whole message after them', () => {
    const { feed } = makeFeed();
    const streamed = [
      feed(assistantText('Checking ', { timestamp_ms: 1 })),
      feed(assistantText('storefront-web.', { timestamp_ms: 2 })),
    ].flat();
    expect(textOf(streamed)).toBe('Checking storefront-web.');
    expect(feed(assistantText('Checking storefront-web.'))).toEqual([]);
  });

  it('does not drop a delta that repeats an earlier one', () => {
    const { feed } = makeFeed();
    const streamed = [
      feed(assistantText('no', { timestamp_ms: 1 })),
      feed(assistantText('no', { timestamp_ms: 2 })),
    ].flat();
    expect(textOf(streamed)).toBe('nono');
  });

  it('starts a new block after a tool call', () => {
    const { feed } = makeFeed();
    feed(assistantText('First.', { timestamp_ms: 1 }));
    feed({ type: 'user', message: { content: [] } });
    expect(textOf(feed(assistantText('Second.', { timestamp_ms: 2 })))).toBe('\n\nSecond.');
  });

  it("keeps today's whole message when the line has no timestamp and nothing was streamed", () => {
    const { feed } = makeFeed();
    expect(textOf(feed(assistantText('Whole.')))).toBe('Whole.');
  });
});
