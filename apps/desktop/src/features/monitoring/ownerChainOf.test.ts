import { describe, expect, it } from 'vitest';
import type { PortOwner } from '@goodboy/core/monitoring';
import { ownerChainOf } from './ownerChainOf';

const AGENT_OWNER: PortOwner = {
  kind: 'agent',
  spawnId: 'spawn-implementer',
  ledgerKind: 'turn',
  sessionId: 's-northwind',
  worktreePath: '/mock/worktrees/payments-api',
  projectId: 'payments-api',
  agentId: 'agent-implementer',
  runId: 'run-fix-credit',
};

const TERMINAL_OWNER: PortOwner = {
  kind: 'terminal',
  spawnId: 'spawn-dev',
  ledgerKind: 'terminal',
  sessionId: 's-northwind',
  worktreePath: '/mock/worktrees/payments-api',
  projectId: 'payments-api',
};

const BRANCH = {
  name: 'payments-api · nw/fix-duplicate-credit',
  mountPath: '/mock/worktrees/payments-api',
};

describe('ownerChainOf', () => {
  it('chains session, agent and run, each with its own place', () => {
    const chain = ownerChainOf({
      owner: AGENT_OWNER,
      sessionTitle: 'Stop retried webhooks posting a second credit',
      agentName: 'Implementer',
      runTitle: 'Fix duplicate credit',
      branch: BRANCH,
    });
    expect(chain.map((link) => [link.kind, link.word, link.label])).toEqual([
      ['session', null, 'Stop retried webhooks posting a second credit'],
      ['agent', 'Agent', 'Implementer'],
      ['run', 'run', 'Fix duplicate credit'],
    ]);
    expect(chain[0]?.to).toMatchObject({ at: 'session', sessionId: 's-northwind' });
    expect(chain[1]?.to).toEqual({
      at: 'agent',
      sessionId: 's-northwind',
      agentId: 'agent-implementer',
    });
    expect(chain[2]?.to).toMatchObject({
      at: 'session',
      view: { lens: 'workflows', target: { kind: 'run', runId: 'run-fix-credit' } },
    });
  });

  it('drops a part it cannot name instead of guessing', () => {
    const chain = ownerChainOf({
      owner: AGENT_OWNER,
      sessionTitle: null,
      agentName: 'Implementer',
      runTitle: null,
      branch: BRANCH,
    });
    expect(chain.map((link) => link.kind)).toEqual(['agent']);
  });

  it('names a shell by its session and its branch', () => {
    const chain = ownerChainOf({
      owner: TERMINAL_OWNER,
      sessionTitle: 'Stop retried webhooks posting a second credit',
      agentName: null,
      runTitle: null,
      branch: BRANCH,
    });
    expect(chain.map((link) => [link.kind, link.word, link.label])).toEqual([
      ['session', null, 'Stop retried webhooks posting a second credit'],
      ['branch', 'Terminal', 'payments-api · nw/fix-duplicate-credit'],
    ]);
    expect(chain[1]?.to).toMatchObject({
      at: 'session',
      view: {
        lens: 'branch',
        target: { kind: 'branch', mountPath: '/mock/worktrees/payments-api', tab: 'pr' },
      },
    });
  });

  it('names a branch no place shows any more without a link', () => {
    const chain = ownerChainOf({
      owner: TERMINAL_OWNER,
      sessionTitle: 'Stop retried webhooks posting a second credit',
      agentName: null,
      runTitle: null,
      branch: { ...BRANCH, mountPath: null },
    });
    expect(chain.map((link) => [link.kind, link.label])).toEqual([
      ['session', 'Stop retried webhooks posting a second credit'],
      ['branch', 'payments-api · nw/fix-duplicate-credit'],
    ]);
    expect(chain[1]?.to).toBeNull();
  });

  it('has no chain for a process outside any session', () => {
    expect(
      ownerChainOf({
        owner: { kind: 'external', name: 'postgres' },
        sessionTitle: null,
        agentName: null,
        runTitle: null,
        branch: null,
      }),
    ).toEqual([]);
    expect(
      ownerChainOf({
        owner: { ...TERMINAL_OWNER, sessionId: null },
        sessionTitle: 'Acme',
        agentName: null,
        runTitle: null,
        branch: BRANCH,
      }),
    ).toEqual([]);
  });
});
