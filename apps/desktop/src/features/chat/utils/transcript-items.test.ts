import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { reduceTranscript, type TranscriptItem } from './transcript-items';
import { reduceTranscriptTrace, resetReduceTranscriptTrace } from './transcript-items-trace';

const RUN = 'run-1' as ProviderRunId;
const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;

type UserTextParams = {
  readonly text: string;
};

const userText = ({ text }: UserTextParams): TurnEvent => ({
  kind: 'user_text',
  runId: RUN,
  text,
  at: AT,
});

type AssistantTextParams = {
  readonly delta: string;
};

const assistantText = ({ delta }: AssistantTextParams): TurnEvent => ({
  kind: 'assistant_text',
  runId: RUN,
  delta,
  at: AT,
});

type ToolStartParams = {
  readonly toolUseId: string;
};

const toolStart = ({ toolUseId }: ToolStartParams): TurnEvent => ({
  kind: 'tool_call_start',
  runId: RUN,
  toolUseId,
  toolName: 'bash',
  input: { cmd: `ls ${toolUseId}` },
  at: AT,
});

type ToolEndParams = {
  readonly toolUseId: string;
  readonly isError?: boolean;
};

const toolEnd = ({ toolUseId, isError = false }: ToolEndParams): TurnEvent => ({
  kind: 'tool_call_end',
  runId: RUN,
  toolUseId,
  output: `out-${toolUseId}`,
  isError,
  at: AT,
});

type PermRequestParams = {
  readonly toolUseId: string;
  readonly toolName: string;
};

const permRequest = ({ toolUseId, toolName }: PermRequestParams): TurnEvent => ({
  kind: 'permission_request',
  runId: RUN,
  toolUseId,
  toolName,
  input: { cmd: 'rm' },
  at: AT,
});

type PermDecisionParams = {
  readonly toolUseId: string;
  readonly decision: 'allow' | 'deny';
};

const permDecision = ({ toolUseId, decision }: PermDecisionParams): TurnEvent => ({
  kind: 'permission_decision',
  runId: RUN,
  toolUseId,
  decision,
  ruleId: null,
  decidedBy: 'user',
  at: AT,
});

type FileEditParams = {
  readonly path: string;
  readonly editType: 'create' | 'modify' | 'delete';
};

const fileEdit = ({ path, editType }: FileEditParams): TurnEvent => ({
  kind: 'file_edit',
  runId: RUN,
  path,
  editType,
  at: AT,
});

const usageEvent = (): TurnEvent => ({
  kind: 'usage',
  runId: RUN,
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    cachedInputTokens: 0,
    estimatedCostUsd: 0.01,
  },
  at: AT,
});

type ErrorParams = {
  readonly message: string;
};

const errorEvent = ({ message }: ErrorParams): TurnEvent => ({
  kind: 'error',
  runId: RUN,
  message,
  retryable: true,
  at: AT,
});

const doneEvent = (): TurnEvent => ({ kind: 'done', runId: RUN, at: AT });

type FreshPassParams = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const freshPass = ({ events }: FreshPassParams): ReadonlyArray<TranscriptItem> =>
  reduceTranscript(events.map((event) => structuredClone(event)));

const mixedEvents = (): ReadonlyArray<TurnEvent> => [
  userText({ text: 'kick off' }),
  assistantText({ delta: 'Hel' }),
  assistantText({ delta: 'lo ' }),
  assistantText({ delta: 'world' }),
  toolStart({ toolUseId: 't1' }),
  toolEnd({ toolUseId: 't1' }),
  assistantText({ delta: 'next ' }),
  assistantText({ delta: 'chunk' }),
  permRequest({ toolUseId: 'p1', toolName: 'Bash' }),
  permDecision({ toolUseId: 'p1', decision: 'allow' }),
  fileEdit({ path: '/a/one.ts', editType: 'modify' }),
  toolStart({ toolUseId: 't2' }),
  assistantText({ delta: 'mid' }),
  toolEnd({ toolUseId: 't2', isError: true }),
  usageEvent(),
  errorEvent({ message: 'boom' }),
  assistantText({ delta: 'a' }),
  assistantText({ delta: 'b' }),
  userText({ text: 'follow up' }),
  toolStart({ toolUseId: 't3' }),
  permRequest({ toolUseId: 'p2', toolName: 'Write' }),
  permDecision({ toolUseId: 'p2', decision: 'deny' }),
  toolEnd({ toolUseId: 't3' }),
  fileEdit({ path: '/a/two.ts', editType: 'create' }),
  assistantText({ delta: 'tail1' }),
  usageEvent(),
  assistantText({ delta: 'tail2' }),
  toolStart({ toolUseId: 't4' }),
  toolEnd({ toolUseId: 't4' }),
  doneEvent(),
  userText({ text: 'more' }),
  assistantText({ delta: 'x' }),
  assistantText({ delta: 'y' }),
  fileEdit({ path: '/a/three.ts', editType: 'delete' }),
  errorEvent({ message: 'second boom' }),
  toolStart({ toolUseId: 't5' }),
  assistantText({ delta: 'z' }),
  toolEnd({ toolUseId: 't5' }),
  usageEvent(),
  assistantText({ delta: 'open tail' }),
];

type GeneratedParams = {
  readonly count: number;
  readonly seed: string;
};

const generatedEvents = ({ count, seed }: GeneratedParams): ReadonlyArray<TurnEvent> =>
  Array.from({ length: count }, (_unused, index) => {
    const slot = index % 5;
    if (slot === 0) {
      return userText({ text: `${seed}-${index}` });
    }
    if (slot === 1) {
      return assistantText({ delta: `${seed}${index}` });
    }
    if (slot === 2) {
      return fileEdit({ path: `/${seed}/${index}.ts`, editType: 'modify' });
    }
    if (slot === 3) {
      return usageEvent();
    }
    return doneEvent();
  });

describe('reduceTranscript incremental resume', () => {
  it('matches a full pass for every growing prefix of a mixed sequence', () => {
    const events = mixedEvents();
    expect(events.length).toBeGreaterThanOrEqual(40);

    for (let length = 1; length <= events.length; length += 1) {
      const prefix = events.slice(0, length);
      const incremental = reduceTranscript(prefix);
      expect(incremental).toEqual(freshPass({ events: prefix }));
    }
  });

  it('keeps an open assistant_text buffer as one item across a resume boundary', () => {
    const events = [
      assistantText({ delta: 'foo' }),
      assistantText({ delta: 'bar' }),
      assistantText({ delta: 'baz' }),
    ];

    expect(reduceTranscript(events.slice(0, 1))).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'foo' },
    ]);
    expect(reduceTranscript(events.slice(0, 2))).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'foobar' },
    ]);
    expect(reduceTranscript(events)).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'foobarbaz' },
    ]);
  });

  it('flushes an open buffer once a later chunk brings a non-text event', () => {
    const events = [
      assistantText({ delta: 'par' }),
      assistantText({ delta: 'tial' }),
      doneEvent(),
      assistantText({ delta: 'after' }),
    ];

    reduceTranscript(events.slice(0, 2));
    const items = reduceTranscript(events);
    expect(items).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'partial' },
      { kind: 'done', key: 'done-2' },
      { kind: 'assistant_text', key: 'text-3', text: 'after' },
    ]);
    expect(items).toEqual(freshPass({ events }));
  });

  it('patches a tool_call item when its end arrives in a later chunk', () => {
    const events = [
      toolStart({ toolUseId: 't9' }),
      assistantText({ delta: 'working' }),
      toolEnd({ toolUseId: 't9', isError: true }),
    ];

    const partial = reduceTranscript(events.slice(0, 2));
    expect(partial[0]).toEqual({
      kind: 'tool_call',
      key: 'tool-t9',
      toolUseId: 't9',
      toolName: 'bash',
      input: { cmd: 'ls t9' },
      output: null,
      isError: false,
      ended: false,
    });

    const items = reduceTranscript(events);
    expect(items[0]).toEqual({
      kind: 'tool_call',
      key: 'tool-t9',
      toolUseId: 't9',
      toolName: 'bash',
      input: { cmd: 'ls t9' },
      output: 'out-t9',
      isError: true,
      ended: true,
    });
    expect(items).toEqual(freshPass({ events }));
  });

  it('does not mutate the cached snapshot when a later chunk patches a tool_call', () => {
    const events = [toolStart({ toolUseId: 't10' }), toolEnd({ toolUseId: 't10' })];

    const partial = reduceTranscript(events.slice(0, 1));
    reduceTranscript(events);
    expect(partial[0]).toEqual({
      kind: 'tool_call',
      key: 'tool-t10',
      toolUseId: 't10',
      toolName: 'bash',
      input: { cmd: 'ls t10' },
      output: null,
      isError: false,
      ended: false,
    });
  });

  it('resolves a permission_decision name from a request seen in an earlier chunk', () => {
    const events = [
      permRequest({ toolUseId: 'p9', toolName: 'Edit' }),
      assistantText({ delta: 'thinking' }),
      permDecision({ toolUseId: 'p9', decision: 'deny' }),
    ];

    reduceTranscript(events.slice(0, 2));
    const items = reduceTranscript(events);
    const decision = items[2];
    expect(decision?.kind).toBe('permission_decision');
    expect(decision?.kind === 'permission_decision' && decision.toolName).toBe('Edit');
    expect(items).toEqual(freshPass({ events }));
  });

  it('keeps two interleaved event streams independent', () => {
    const first = mixedEvents();
    const second = generatedEvents({ count: 30, seed: 'b' });

    for (let length = 1; length <= 30; length += 1) {
      const firstPrefix = first.slice(0, length);
      const secondPrefix = second.slice(0, length);
      expect(reduceTranscript(firstPrefix)).toEqual(freshPass({ events: firstPrefix }));
      expect(reduceTranscript(secondPrefix)).toEqual(freshPass({ events: secondPrefix }));
    }
  });

  it('recomputes fully for an unrelated array that only shares the first event', () => {
    const first = mixedEvents();
    reduceTranscript(first);

    const other = [first[0]!, ...generatedEvents({ count: 12, seed: 'c' })];
    expect(reduceTranscript(other)).toEqual(freshPass({ events: other }));
  });

  it('falls back to a full pass for a shorter unrelated array', () => {
    const first = mixedEvents();
    reduceTranscript(first);

    const shorter = generatedEvents({ count: 4, seed: 'd' });
    expect(reduceTranscript(shorter)).toEqual(freshPass({ events: shorter }));
  });

  it('processes exactly one event when a 101st arrives after a 100-event pass', () => {
    const events = generatedEvents({ count: 101, seed: 'e' });

    resetReduceTranscriptTrace();
    reduceTranscript(events.slice(0, 100));
    expect(reduceTranscriptTrace.processed).toBe(100);

    resetReduceTranscriptTrace();
    reduceTranscript(events);
    expect(reduceTranscriptTrace.processed).toBe(1);
  });

  it('performs a full pass when the first event is a different object after structuredClone', () => {
    const events = generatedEvents({ count: 50, seed: 'f' });
    reduceTranscript(events);

    const cloned = events.map((event) => structuredClone(event));
    resetReduceTranscriptTrace();
    const items = reduceTranscript(cloned);
    expect(reduceTranscriptTrace.processed).toBe(cloned.length);
    expect(items).toEqual(freshPass({ events: cloned }));
  });
});
