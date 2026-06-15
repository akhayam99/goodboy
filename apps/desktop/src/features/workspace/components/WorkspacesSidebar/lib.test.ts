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
import { pluralize, resolverStatus, workflowKindName } from './lib';

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
    expect(workflowKindName(makeWorkflow('Refactor'))).toBe('refactor');
  });

  it('matches the library entry case-insensitively', () => {
    expect(workflowKindName(makeWorkflow('rEfAcToR'))).toBe('refactor');
  });

  it('returns the trimmed raw name for an unknown workflow', () => {
    expect(workflowKindName(makeWorkflow('  MyCustomFlow  '))).toBe('MyCustomFlow');
  });
});

describe('pluralize', () => {
  it('keeps the singular for a count of one', () => {
    expect(pluralize(1, 'agent')).toBe('1 agent');
  });

  it('pluralizes zero', () => {
    expect(pluralize(0, 'agent')).toBe('0 agents');
  });

  it('pluralizes counts above one', () => {
    expect(pluralize(3, 'agent')).toBe('3 agents');
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

  it('reports "committed" from the committed resolver state', () => {
    expect(resolverStatus(makeAgent('completed'), empty, empty, 'committed')).toBe('committed');
  });

  it('reports "committed" when the source thread is pending resolution', () => {
    const agent = makeAgent('completed', 't2');
    expect(resolverStatus(agent, empty, new Set(['t2']), undefined)).toBe('committed');
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
