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
import { pluralize, resolveCompletionTab, resolverStatus, workflowKindName } from './lib';

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

describe('resolveCompletionTab', () => {
  it('defaults to active when there is anything active and nothing selected', () => {
    expect(resolveCompletionTab({ activeCount: 1, completedCount: 0, selected: null })).toBe(
      'active',
    );
    expect(resolveCompletionTab({ activeCount: 2, completedCount: 3, selected: null })).toBe(
      'active',
    );
  });

  it('opens on completed when active is empty but completed is not and nothing selected', () => {
    expect(resolveCompletionTab({ activeCount: 0, completedCount: 1, selected: null })).toBe(
      'completed',
    );
  });

  it('defaults to active when both are empty and nothing selected', () => {
    expect(resolveCompletionTab({ activeCount: 0, completedCount: 0, selected: null })).toBe(
      'active',
    );
  });

  it('keeps an explicit selection that still has items', () => {
    expect(resolveCompletionTab({ activeCount: 2, completedCount: 1, selected: 'completed' })).toBe(
      'completed',
    );
    expect(resolveCompletionTab({ activeCount: 2, completedCount: 1, selected: 'active' })).toBe(
      'active',
    );
  });

  it('falls back to completed when the explicitly selected active tab empties out', () => {
    expect(resolveCompletionTab({ activeCount: 0, completedCount: 1, selected: 'active' })).toBe(
      'completed',
    );
  });

  it('falls back to active when the explicitly selected completed tab empties out', () => {
    expect(resolveCompletionTab({ activeCount: 1, completedCount: 0, selected: 'completed' })).toBe(
      'active',
    );
  });

  it('keeps the explicit selection when both tabs are empty', () => {
    expect(resolveCompletionTab({ activeCount: 0, completedCount: 0, selected: 'completed' })).toBe(
      'completed',
    );
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
