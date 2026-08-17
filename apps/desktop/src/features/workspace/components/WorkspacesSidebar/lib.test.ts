import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  SessionId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { resolverStatus, workflowKindName } from './lib';

const NOW = '2026-05-15T00:00:00.000Z' as IsoDateTime;
const SESSION = 'sess_1' as SessionId;
const WS = 'ws_1' as WorkspaceId;

const makeWorkflow = (name: string): Workflow => ({
  id: 'wf_1' as WorkflowId,
  workspaceId: WS,
  name,
  description: '',
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
});

const makeAgent = (status: AgentStatus, sourceThreadId?: string): Agent => ({
  id: 'a1' as AgentId,
  sessionId: SESSION,
  ordinal: 0,
  name: 'resolver',
  status,
  sourceThreadId,
});

describe('workflowKindName', () => {
  it('returns "custom" for a blank name', () => {
    expect(workflowKindName(makeWorkflow('   '))).toBe('custom');
  });

  it('returns the library name lowercased for a known workflow', () => {
    expect(workflowKindName(makeWorkflow('Refactor (example)'))).toBe('refactor (example)');
  });

  it('matches the library entry case-insensitively', () => {
    expect(workflowKindName(makeWorkflow('rEfAcToR (ExAmPlE)'))).toBe('refactor (example)');
  });

  it('returns the trimmed raw name for an unknown workflow', () => {
    expect(workflowKindName(makeWorkflow('  MyCustomFlow  '))).toBe('MyCustomFlow');
  });
});

describe('resolverStatus', () => {
  const empty: ReadonlySet<string> = new Set();

  it('reports running agents', () => {
    expect(resolverStatus(makeAgent('running'), empty, empty, undefined)).toBe('running');
  });

  it('reports failed agents', () => {
    expect(resolverStatus(makeAgent('failed'), empty, empty, undefined)).toBe('failed');
  });

  it('reports pending agents', () => {
    expect(resolverStatus(makeAgent('pending'), empty, empty, undefined)).toBe('pending');
  });

  it('reports "resolved" when the source thread is resolved', () => {
    const agent = makeAgent('completed', 't1');
    expect(resolverStatus(agent, new Set(['t1']), empty, undefined)).toBe('resolved');
  });

  it('reports combined resolvers as resolved only when every thread is resolved', () => {
    const agent = { ...makeAgent('completed', 't1'), sourceThreadIds: ['t1', 't2'] };
    expect(resolverStatus(agent, new Set(['t1']), empty, undefined)).toBe('done');
    expect(resolverStatus(agent, new Set(['t1', 't2']), empty, undefined)).toBe('resolved');
  });

  it('reports "committed" from the committed resolver state', () => {
    expect(resolverStatus(makeAgent('completed'), empty, empty, 'committed')).toBe('committed');
  });

  it('reports "committed" when the source thread is pending resolution', () => {
    const agent = makeAgent('completed', 't2');
    expect(resolverStatus(agent, empty, new Set(['t2']), undefined)).toBe('committed');
  });

  it('reports "analyzed" from the resolver state', () => {
    expect(resolverStatus(makeAgent('completed'), empty, empty, 'analyzed')).toBe('analyzed');
  });

  it('reports "wontfix" from the resolver state', () => {
    expect(resolverStatus(makeAgent('completed'), empty, empty, 'wontfix')).toBe('wontfix');
  });

  it('reports "awaiting" from the resolver state', () => {
    expect(resolverStatus(makeAgent('completed'), empty, empty, 'awaiting')).toBe('awaiting');
  });

  it('falls back to "done"', () => {
    expect(resolverStatus(makeAgent('completed'), empty, empty, undefined)).toBe('done');
  });

  it('prefers "resolved" over a committed state', () => {
    const agent = makeAgent('completed', 't1');
    expect(resolverStatus(agent, new Set(['t1']), new Set(['t1']), 'committed')).toBe('resolved');
  });
});
