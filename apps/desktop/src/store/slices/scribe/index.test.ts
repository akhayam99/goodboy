import { describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, SessionId } from '@goodboy/types';

vi.mock('../../../features/session/components/AgentSpawnConfig/taskModelAgentSpawnConfig', () => ({
  taskModelAgentSpawnConfig: () => ({
    hint: '',
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
  }),
}));

import { createScribeSlice } from './index';
import { scribeInitialState } from './state';
import { isUntouchedScribeBody, referenceLinesOf, signScribeBody } from './scribeSignature';
import { scribeKickoff } from './scribeKickoff';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-ledger' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;
const AGENT_ID = 'agent-scribe' as AgentId;

const harness = ({ prBody }: { readonly prBody: string }) => {
  let state: Record<string, unknown> = {
    ...scribeInitialState,
    sessions: [
      {
        id: SESSION_ID,
        workspaceId: 'workspace-harborline',
        goal: 'Make ledger postings idempotent',
        providerPreference: { defaultProvider: 'anthropic' },
      },
    ],
    projects: [{ id: 'project-ledger', name: 'ledger-core', baseBranch: 'main' }],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: 'project-ledger',
          mountName: 'ledger-core',
          worktreePath: '/w/ledger',
          branch: 'fix/ledger-postings',
          baseBranch: 'main',
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
    sessionSlots: { [SESSION_ID]: [{ key: 'decisions', value: 'Key the batch by event id' }] },
    sessionExternalTasks: {},
    workspaceOverrides: {},
    providerLimits: {},
    mountGithub: {
      [MOUNT_ID]: { pr: { number: 418, state: 'open', body: prBody } },
    },
    spawnAgent: vi.fn(async () => AGENT_ID),
    sendTurn: vi.fn(async () => ({ blockedOverBudget: false })),
    editPr: vi.fn(async () => undefined),
  };
  const set = ((patch: unknown) => {
    const next =
      typeof patch === 'function'
        ? (patch as (s: Record<string, unknown>) => object)(state)
        : patch;
    state = { ...state, ...(next as object) };
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  const slice = createScribeSlice(set, get);
  state = { ...state, ...slice };
  return { slice, read: () => state as unknown as ReturnType<GetFn> };
};

describe('scribe signature', () => {
  it('recognises a body Goodboy wrote and one a person edited', () => {
    const signed = signScribeBody({ body: 'Retried batches no longer post twice.\n\nCloses #41' });

    expect(isUntouchedScribeBody({ body: signed })).toBe(true);
    expect(isUntouchedScribeBody({ body: signed.replace('twice', 'again') })).toBe(false);
    expect(isUntouchedScribeBody({ body: 'Written by hand' })).toBe(false);
    expect(referenceLinesOf({ body: signed })).toEqual(['Closes #41']);
  });
});

describe('scribe slice', () => {
  it('starts the hidden scribe on the branch mount and never with a generalist name', async () => {
    const { slice, read } = harness({ prBody: '' });

    await slice.requestScribe({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true },
    });

    expect(read().spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ name: 'Scribe', kindOverride: 'scribe', mountId: MOUNT_ID }),
    );
    expect(read().scribeAgents[AGENT_ID]).toBe('pr:mount-ledger');
    expect(read().scribeWork['pr:mount-ledger']?.status).toBe('writing');
    expect(read().sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Key the batch by event id') }),
    );
  });

  it('keeps the text ready for the form once Scribe answers', async () => {
    const { slice, read } = harness({ prBody: '' });
    await slice.requestScribe({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true },
    });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: '<<pr-title>>Guard postings<</pr-title>>\n<<pr-body>>Body<</pr-body>>',
      hasFailed: false,
    });

    expect(read().scribeWork['pr:mount-ledger']).toMatchObject({
      status: 'ready',
      output: { prTitle: 'Guard postings', prBody: 'Body' },
    });
    expect(read().scribeAgents[AGENT_ID]).toBeUndefined();
  });

  it('rewrites the pull request body only while it is still the one Goodboy wrote', async () => {
    const signed = signScribeBody({ body: 'Old body\n\nCloses #41' });
    const { slice, read } = harness({ prBody: signed });

    await expect(
      slice.refreshPrDescription({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toBe(true);
    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: '<<pr-body>>New body<</pr-body>>',
      hasFailed: false,
    });

    expect(read().editPr).toHaveBeenCalledWith(SESSION_ID, 418, {
      body: signScribeBody({ body: 'New body\n\nCloses #41' }),
    });
  });

  it('leaves a body a person edited alone', async () => {
    const { slice, read } = harness({ prBody: 'Written by hand' });

    await expect(
      slice.refreshPrDescription({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ).resolves.toBe(false);
    expect(read().spawnAgent).not.toHaveBeenCalled();
  });
});

describe('scribeKickoff', () => {
  it('asks for one combined message when commits are squashed', () => {
    const text = scribeKickoff({
      task: {
        kind: 'commit-message',
        verb: 'squash',
        commits: [
          { sha: '3a1f9c2', subject: 'Guard the settlement batch' },
          { sha: '5b3e91f', subject: 'Add retry test' },
        ],
      },
      branch: 'fix/ledger-postings',
      baseBranch: 'main',
      goal: 'Make ledger postings idempotent',
      decisions: '',
      summary: '',
      issues: [],
    });

    expect(text).toContain('These commits become one');
    expect(text).toContain('for="3a1f9c2"');
  });
});
