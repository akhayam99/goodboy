import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from './transcript-items';
import { permissionFor, toolStatus } from './toolStatus';

type ToolItem = Extract<TranscriptItem, { kind: 'tool_call' }>;

const runId = (value: string): ProviderRunId => JSON.parse(JSON.stringify(value));
const iso = (value: string): IsoDateTime => JSON.parse(JSON.stringify(value));

const RUN_1 = runId('run-1');
const RUN_2 = runId('run-2');

const tool = (overrides: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool_call',
  key: 'tool-1',
  toolUseId: 't1',
  toolName: 'bash',
  input: null,
  output: null,
  isError: false,
  ended: false,
  runId: RUN_1,
  startedAt: iso('2026-06-08T10:00:00.000Z'),
  endedAt: null,
  ...overrides,
});

const request = (toolUseId: string): TranscriptItem => ({
  kind: 'permission_request',
  key: `perm-req-${toolUseId}`,
  toolUseId,
  toolName: 'bash',
  runId: RUN_1,
  input: null,
  at: iso('2026-06-08T10:00:00.000Z'),
});

const decision = (toolUseId: string, value: 'allow' | 'deny'): TranscriptItem => ({
  kind: 'permission_decision',
  key: `perm-dec-${toolUseId}`,
  toolUseId,
  toolName: 'bash',
  runId: RUN_1,
  decision: value,
  ruleId: null,
  decidedBy: 'user',
  at: iso('2026-06-08T10:00:01.000Z'),
});

describe('toolStatus', () => {
  it('is running while unended and the caller does not vouch for the run', () => {
    expect(toolStatus({ item: tool() })).toBe('running');
  });

  it('is running while unended on the currently active run', () => {
    expect(toolStatus({ item: tool({ runId: RUN_1 }), activeRunId: RUN_1 })).toBe('running');
  });

  it('is done once ended without error', () => {
    expect(
      toolStatus({ item: tool({ ended: true, endedAt: iso('2026-06-08T10:00:02.000Z') }) }),
    ).toBe('done');
  });

  it('is failed once ended with an error', () => {
    expect(
      toolStatus({
        item: tool({ ended: true, isError: true, endedAt: iso('2026-06-08T10:00:02.000Z') }),
      }),
    ).toBe('failed');
  });

  it('is approval while a permission request has no decision yet', () => {
    const permission = permissionFor({ items: [request('t1')], toolUseId: 't1' });
    expect(toolStatus({ item: tool(), permission })).toBe('approval');
  });

  it('is denied once the permission decision is deny, even if never ended', () => {
    const permission = permissionFor({
      items: [request('t1'), decision('t1', 'deny')],
      toolUseId: 't1',
    });
    expect(toolStatus({ item: tool(), permission })).toBe('denied');
  });

  it('is stopped once the turn has ended, canceling an unclosed tool', () => {
    expect(toolStatus({ item: tool(), activeRunId: null })).toBe('stopped');
  });

  it('is stopped once a later run has started, orphaning an unclosed tool', () => {
    expect(toolStatus({ item: tool({ runId: RUN_1 }), activeRunId: RUN_2 })).toBe('stopped');
  });
});

describe('permissionFor', () => {
  it('reports no permission when none is present', () => {
    expect(permissionFor({ items: [], toolUseId: 't1' })).toEqual({
      requested: false,
      decision: null,
    });
  });

  it('reports a pending request with no decision', () => {
    expect(permissionFor({ items: [request('t1')], toolUseId: 't1' })).toEqual({
      requested: true,
      decision: null,
    });
  });

  it('reports the decision once it lands', () => {
    expect(
      permissionFor({ items: [request('t1'), decision('t1', 'allow')], toolUseId: 't1' }),
    ).toEqual({ requested: true, decision: 'allow' });
  });

  it('ignores permission items for a different toolUseId', () => {
    expect(permissionFor({ items: [request('t2')], toolUseId: 't1' })).toEqual({
      requested: false,
      decision: null,
    });
  });
});
