import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProviderRunId, type SessionId } from '@goodboy/types';
import type { TurnFileSet } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import { doneFilesByAgentOf, doneFilesOf } from './doneFilesOf';

const SESSION: SessionId = aSession({ workspaceId: aWorkspace({}).id }).id;

const setOf = (patch: Partial<TurnFileSet> & { readonly run: string }): TurnFileSet => ({
  runId: brandId<ProviderRunId>({ value: patch.run }),
  mountId: brandId<MountId>({ value: 'mount-payments' }),
  sessionId: SESSION,
  own: [],
  fromBase: [],
  isPartial: false,
  recordedAtMs: Date.parse('2026-10-20T10:00:00.000Z'),
  ...patch,
});

const modified = (path: string, additions: number, deletions: number) => ({
  path,
  status: 'modified' as const,
  additions,
  deletions,
});

describe('doneFilesByAgentOf', () => {
  it('gives each agent the files of its own runs and never another agent', () => {
    const sets = [
      setOf({ run: 'run-1', own: [modified('src/retry.ts', 42, 6)], fromBase: ['src/post.ts'] }),
      setOf({ run: 'run-2', own: [modified('docs/webhooks.md', 7, 2)] }),
    ];

    const byAgent = doneFilesByAgentOf({
      sets,
      runIdsByAgentId: new Map([
        ['agent-auto', [brandId<ProviderRunId>({ value: 'run-1' })]],
        ['agent-scout', [brandId<ProviderRunId>({ value: 'run-2' })]],
        ['agent-idle', []],
      ]),
    });

    expect(byAgent.get('agent-auto')).toEqual({
      own: [modified('src/retry.ts', 42, 6)],
      fromBase: ['src/post.ts'],
    });
    expect(byAgent.get('agent-scout')?.own.map((file) => file.path)).toEqual(['docs/webhooks.md']);
    expect(byAgent.has('agent-idle')).toBe(false);
  });

  it('keeps the newest count of a file two turns wrote and drops a hidden file the agent wrote later', () => {
    const sets = [
      setOf({ run: 'run-1', own: [modified('src/retry.ts', 10, 0)], fromBase: ['src/post.ts'] }),
      setOf({
        run: 'run-2',
        own: [modified('src/post.ts', 1, 1), modified('src/retry.ts', 12, 2)],
      }),
    ];

    const byAgent = doneFilesByAgentOf({
      sets,
      runIdsByAgentId: new Map([
        [
          'agent-auto',
          [brandId<ProviderRunId>({ value: 'run-1' }), brandId<ProviderRunId>({ value: 'run-2' })],
        ],
      ]),
    });

    expect(byAgent.get('agent-auto')?.own.find((file) => file.path === 'src/retry.ts')).toEqual(
      modified('src/retry.ts', 12, 2),
    );
    expect(byAgent.get('agent-auto')?.fromBase).toEqual([]);
  });
});

describe('doneFilesOf', () => {
  const byAgentId = new Map([
    ['a', { own: [modified('one.ts', 1, 0)], fromBase: ['base.ts'] }],
    ['b', { own: [modified('two.ts', 2, 0)], fromBase: [] }],
  ]);

  it('joins the agents of a row and says nothing when none wrote a file', () => {
    expect(doneFilesOf({ agentIds: ['a', 'b'], byAgentId })?.own.map((file) => file.path)).toEqual([
      'one.ts',
      'two.ts',
    ]);
    expect(doneFilesOf({ agentIds: ['c'], byAgentId })).toBeNull();
    expect(
      doneFilesOf({ agentIds: ['x'], byAgentId: new Map([['x', { own: [], fromBase: [] }]]) }),
    ).toBeNull();
  });
});
