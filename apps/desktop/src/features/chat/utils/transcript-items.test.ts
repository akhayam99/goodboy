import { describe, expect, it } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { encodeCliTooOldMessage } from '../turn';
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

describe('reduceTranscript sent via', () => {
  it('keeps how a queued or interrupting message was sent', () => {
    const items = reduceTranscript([
      userText({ text: 'move rounding into settle_batch' }),
      { kind: 'user_text', runId: RUN, text: 'keep the flag', sentVia: 'queued', at: AT },
      { kind: 'user_text', runId: RUN, text: 'use decimals', sentVia: 'interrupt', at: AT },
      userText({ text: 'plain' }),
    ]);

    expect(items.map((item) => (item.kind === 'user_text' ? item.sentVia : null))).toEqual([
      null,
      'queued',
      'interrupt',
      undefined,
    ]);
  });
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
      runId: RUN,
      startedAt: AT,
      endedAt: null,
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
      runId: RUN,
      startedAt: AT,
      endedAt: AT,
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
      runId: RUN,
      startedAt: AT,
      endedAt: null,
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

const reportEnvelope = ({ title }: { readonly title: string }): string =>
  [
    '<<artifact v=1 kind=report>>',
    JSON.stringify({ title, format: 'markdown', content: '# heading\n\nbody' }),
    '<</artifact>>',
  ].join('\n');

describe('reduceTranscript artifact envelopes', () => {
  it('replaces a lone complete block with a compact item and no assistant text', () => {
    const events = [assistantText({ delta: reportEnvelope({ title: 'Release readout' }) })];

    expect(reduceTranscript(events)).toEqual([
      {
        kind: 'artifact_block',
        key: 'text-0-artifact-0',
        artifactKind: 'report',
        title: 'Release readout',
        complete: true,
        runId: RUN,
      },
    ]);
  });

  it('keeps the prose before and after a block and drops the envelope', () => {
    const text = [
      'here is the readout.',
      '',
      reportEnvelope({ title: 'Release readout' }),
      '',
      'tell me what to change.',
    ].join('\n');
    const events = [assistantText({ delta: text }), doneEvent()];

    const items = reduceTranscript(events);
    expect(items).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'here is the readout.\n' },
      {
        kind: 'artifact_block',
        key: 'text-0-artifact-0',
        artifactKind: 'report',
        title: 'Release readout',
        complete: true,
        runId: RUN,
      },
      { kind: 'assistant_text', key: 'text-0-prose-1', text: '\ntell me what to change.' },
      { kind: 'done', key: 'done-1' },
    ]);
    expect(
      items.some((item) => item.kind === 'assistant_text' && item.text.includes('<<artifact')),
    ).toBe(false);
  });

  it('renders an incomplete block as a pending item, never as raw text', () => {
    const text = [
      'writing it now.',
      '<<artifact v=1 kind=wireframe>>',
      '{"title":"Checkout flow","format":"json","content":{',
    ].join('\n');

    expect(reduceTranscript([assistantText({ delta: text })])).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'writing it now.' },
      {
        kind: 'artifact_block',
        key: 'text-0-artifact-0',
        artifactKind: 'wireframe',
        title: null,
        complete: false,
        runId: RUN,
      },
    ]);
  });

  it('emits one item per block when a turn carries two of them', () => {
    const text = [
      reportEnvelope({ title: 'First' }),
      'and the plan:',
      '<<artifact v=1 kind=plan>>',
      JSON.stringify({ title: 'Second', format: 'markdown', content: '- one\n- two' }),
      '<</artifact>>',
    ].join('\n');

    expect(reduceTranscript([assistantText({ delta: text })])).toEqual([
      {
        kind: 'artifact_block',
        key: 'text-0-artifact-0',
        artifactKind: 'report',
        title: 'First',
        complete: true,
        runId: RUN,
      },
      { kind: 'assistant_text', key: 'text-0', text: 'and the plan:' },
      {
        kind: 'artifact_block',
        key: 'text-0-artifact-1',
        artifactKind: 'plan',
        title: 'Second',
        complete: true,
        runId: RUN,
      },
    ]);
  });

  it('never exposes the envelope while the block arrives across several deltas', () => {
    const chunks = [
      'here it comes.\n',
      '<<artifact v=1 kind=report>>\n',
      '{"title":"Release readout",',
      '"format":"markdown","content":"# heading"}\n',
      '<</artifact>>\n',
      'done.',
    ];
    const events = chunks.map((delta) => assistantText({ delta }));

    for (let length = 1; length <= events.length; length += 1) {
      const prefix = events.slice(0, length);
      const items = reduceTranscript(prefix);
      expect(items).toEqual(freshPass({ events: prefix }));
      for (const item of items) {
        if (item.kind === 'assistant_text') {
          expect(item.text).not.toContain('<<artifact');
          expect(item.text).not.toContain('<</artifact>>');
        }
      }
    }

    expect(reduceTranscript(events)).toEqual([
      { kind: 'assistant_text', key: 'text-0', text: 'here it comes.' },
      {
        kind: 'artifact_block',
        key: 'text-0-artifact-0',
        artifactKind: 'report',
        title: 'Release readout',
        complete: true,
        runId: RUN,
      },
      { kind: 'assistant_text', key: 'text-0-prose-1', text: 'done.' },
    ]);
  });

  it('stamps each block with the run that wrote it, not with the first run of the turn', () => {
    const second = 'run-2' as ProviderRunId;
    const events: ReadonlyArray<TurnEvent> = [
      assistantText({ delta: reportEnvelope({ title: 'First' }) }),
      doneEvent(),
      {
        kind: 'assistant_text',
        runId: second,
        delta: reportEnvelope({ title: 'Second' }),
        at: AT,
      },
    ];

    const blocks = reduceTranscript(events).filter((item) => item.kind === 'artifact_block');
    expect(blocks.map((block) => block.runId)).toEqual([RUN, second]);
  });

  it('leaves an envelope inside a code fence as plain assistant text', () => {
    const text = ['look at this:', '```', '<<artifact v=1 kind=report>>', '```'].join('\n');

    expect(reduceTranscript([assistantText({ delta: text })])).toEqual([
      { kind: 'assistant_text', key: 'text-0', text },
    ]);
  });
});

describe('reduceTranscript artifact scan reuse', () => {
  const BODY_LINES = 200;
  const BODY_LINE_LENGTH = 200;
  const BODY_CHUNKS = 200;
  const BODY_CHUNK_LENGTH = 200;

  it('scans only the tail while a long block arrives across many deltas', () => {
    const deltas = ['here it comes.\n', '<<artifact v=1 kind=report>>\n'];
    for (let line = 0; line < BODY_LINES; line += 1) {
      deltas.push(`${'x'.repeat(BODY_LINE_LENGTH)}\n`);
    }
    deltas.push('<</artifact>>\n');
    const events = deltas.map((delta) => assistantText({ delta }));
    const turnLength = deltas.join('').length;

    resetReduceTranscriptTrace();
    for (let length = 1; length <= events.length; length += 1) {
      reduceTranscript(events.slice(0, length));
    }

    expect(reduceTranscriptTrace.textScans).toBe(events.length);
    expect(reduceTranscriptTrace.textScanRestarts).toBe(1);
    expect(reduceTranscriptTrace.textScanChars).toBeLessThan(turnLength * 2);
  });

  it('scans only the tail while one json line grows across many deltas', () => {
    const deltas = ['here it comes.\n', '<<artifact v=1 kind=report>>\n', '{"title":"Rollout"'];
    for (let chunk = 0; chunk < BODY_CHUNKS; chunk += 1) {
      deltas.push(`,"k${chunk}":"${'x'.repeat(BODY_CHUNK_LENGTH)}"`);
    }
    deltas.push('}\n', '<</artifact>>\n');
    const events = deltas.map((delta) => assistantText({ delta }));
    const turnLength = deltas.join('').length;

    resetReduceTranscriptTrace();
    for (let length = 1; length <= events.length; length += 1) {
      reduceTranscript(events.slice(0, length));
    }

    expect(reduceTranscriptTrace.textScans).toBe(events.length);
    expect(reduceTranscriptTrace.textScanRestarts).toBe(1);
    expect(reduceTranscriptTrace.textScanChars).toBeLessThan(turnLength * 2);
  });

  it('restarts the scan for every fresh pass over the same turn', () => {
    const events = [
      assistantText({ delta: '<<artifact v=1 kind=plan>>\n' }),
      assistantText({ delta: '{"title":"Rollout"}\n' }),
      assistantText({ delta: '<</artifact>>\n' }),
    ];

    resetReduceTranscriptTrace();
    for (let length = 1; length <= events.length; length += 1) {
      const prefix = events.slice(0, length);
      expect(reduceTranscript(prefix)).toEqual(freshPass({ events: prefix }));
    }
    expect(reduceTranscriptTrace.textScanRestarts).toBe(events.length + 1);
  });
});

describe('reduceTranscript cli refusals', () => {
  it('turns an encoded CLI refusal into a cli_too_old item with its run', () => {
    const payload = {
      providerId: 'anthropic',
      modelKey: 'opus-5.5',
      installedVersion: '2.1.259',
      requiredVersion: '2.1.280',
      fallbackModelKey: null,
      detail: 'raw',
    } as const;
    const items = reduceTranscript([
      { kind: 'error', runId: RUN, message: encodeCliTooOldMessage(payload), at: AT },
    ]);
    expect(items).toEqual([{ kind: 'cli_too_old', key: 'cli-0', runId: RUN, payload }]);
  });
});

describe('reduceTranscript handoff', () => {
  const AGENT = 'agent-4' as AgentId;

  it('turns the user text that carries a handoff into the handoff block', () => {
    const items = reduceTranscript([
      {
        kind: 'user_text',
        runId: RUN,
        text: '**Goal** settle\n\nRound once per batch.',
        handoffId: AGENT,
        at: AT,
      },
      assistantText({ delta: 'On it.' }),
      userText({ text: 'Also cover refunds.' }),
    ]);

    expect(items.map((item) => item.kind)).toEqual(['handoff', 'assistant_text', 'user_text']);
    expect(items[0]).toMatchObject({ kind: 'handoff', handoffId: AGENT });
  });

  it('shows the first message of an older agent as a handoff in the older format', () => {
    const items = reduceTranscript([
      userText({ text: 'Which services read the per-line totals?' }),
      assistantText({ delta: 'Two of them.' }),
      userText({ text: 'Which two?' }),
    ]);

    expect(items[0]).toMatchObject({
      kind: 'handoff',
      handoffId: null,
      text: 'Which services read the per-line totals?',
    });
    expect(items[2]).toMatchObject({ kind: 'user_text', text: 'Which two?' });
  });

  it('keeps the first message rule across an incremental resume', () => {
    const events: TurnEvent[] = [userText({ text: 'Trace the rounding.' })];
    reduceTranscript(events);
    events.push(assistantText({ delta: 'Done.' }), userText({ text: 'Now fix it.' }));

    expect(reduceTranscript(events).map((item) => item.kind)).toEqual([
      'handoff',
      'assistant_text',
      'user_text',
    ]);
  });
});
