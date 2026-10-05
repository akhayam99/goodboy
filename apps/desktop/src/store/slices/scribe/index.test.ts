// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, SessionId } from '@goodboy/types';

vi.mock('../../../features/session/taskModelAgentSpawnConfig', () => ({
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

const CREATED_URL = 'https://github.com/harborline/ledger-core/pull/418';

const harness = ({
  prBody,
  hasPr = true,
}: {
  readonly prBody: string;
  readonly hasPr?: boolean;
}) => {
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
      [MOUNT_ID]: {
        pr: hasPr
          ? { number: 418, state: 'open', title: 'Old title', url: CREATED_URL, body: prBody }
          : null,
      },
    },
    createPrForSession: vi.fn(async () => ({ number: 418, url: CREATED_URL })),
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
  const slice = createScribeSlice({ set, get });
  state = { ...state, ...slice };
  return { slice, read: () => state as unknown as ReturnType<GetFn> };
};

const PR_KEY = 'pr:mount-ledger';
const PROPOSAL = '<<pr-title>>Guard postings<</pr-title>>\n<<pr-body>>Body<</pr-body>>';

const askedForPr = async ({
  hasPr,
  prBody = '',
  isDraft = true,
  base = null,
}: {
  readonly hasPr: boolean;
  readonly prBody?: string;
  readonly isDraft?: boolean;
  readonly base?: string | null;
}) => {
  const built = harness({ prBody, hasPr });
  await built.slice.requestScribe({
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft, base },
  });
  return built;
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
      task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
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

  it('opens the draft with the text Scribe wrote once it answers', async () => {
    const { slice, read } = await askedForPr({ hasPr: false });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    expect(read().createPrForSession).toHaveBeenCalledExactlyOnceWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      title: 'Guard postings',
      body: 'Body',
      draft: true,
      isScribeBody: true,
    });
    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'created',
      error: null,
      output: { prTitle: 'Guard postings', prBody: 'Body' },
      pullRequest: { number: 418, url: CREATED_URL },
    });
  });

  it('opens it ready for review when the person did not ask for a draft', async () => {
    const { slice, read } = await askedForPr({ hasPr: false, isDraft: false, base: 'release' });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    expect(read().createPrForSession).toHaveBeenCalledWith(
      expect.objectContaining({ draft: false, base: 'release' }),
    );
  });

  it('keeps the proposal and the reason when opening fails, and opens it on Retry', async () => {
    const { slice, read } = await askedForPr({ hasPr: false });
    vi.mocked(read().createPrForSession).mockRejectedValueOnce(
      new Error("Couldn't push fix/ledger-postings: remote: Permission denied"),
    );

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'failed',
      error: "Couldn't push fix/ledger-postings: remote: Permission denied",
      output: { prTitle: 'Guard postings', prBody: 'Body' },
      pullRequest: null,
    });

    await slice.openScribePullRequest({ key: PR_KEY });

    expect(read().createPrForSession).toHaveBeenCalledTimes(2);
    expect(read().scribeWork[PR_KEY]).toMatchObject({ status: 'created', error: null });
  });

  it('fails with a reason, never silently, when Scribe wrote no text', async () => {
    const { slice, read } = await askedForPr({ hasPr: false });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: 'I looked at the diff.',
      hasFailed: false,
    });

    expect(read().createPrForSession).not.toHaveBeenCalled();
    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'failed',
      error: 'Scribe wrote no text.',
    });
  });

  it('does not open a second request when the branch already has one', async () => {
    const { slice, read } = await askedForPr({ hasPr: true, prBody: 'Written by hand' });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    expect(read().createPrForSession).not.toHaveBeenCalled();
    expect(read().editPr).not.toHaveBeenCalled();
    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'created',
      pullRequest: { number: 418, url: CREATED_URL },
    });
  });

  it('keeps answering to the Scribe agent after its first turn so a follow-up is still its turn', async () => {
    const { slice, read } = await askedForPr({ hasPr: false });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    expect(read().scribeAgents[AGENT_ID]).toBe(PR_KEY);
  });

  it('leaves the proposal alone when a follow-up turn brings no new text', async () => {
    const { slice, read } = await askedForPr({ hasPr: false });
    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: 'No, I only write the text. The engine opens the draft.',
      hasFailed: false,
    });

    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'created',
      output: { prTitle: 'Guard postings', prBody: 'Body' },
    });
    expect(read().createPrForSession).toHaveBeenCalledTimes(1);
  });

  it('updates only what a follow-up changes and opens it after a failed first try', async () => {
    const { slice, read } = await askedForPr({ hasPr: false });
    vi.mocked(read().createPrForSession).mockRejectedValueOnce(new Error('gh is not installed'));
    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: '<<pr-body>>Shorter body<</pr-body>>',
      hasFailed: false,
    });

    expect(read().createPrForSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Guard postings', body: 'Shorter body' }),
    );
    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'created',
      output: { prTitle: 'Guard postings', prBody: 'Shorter body' },
    });
  });

  it('puts a changed follow-up on the request while it is still the text Goodboy wrote', async () => {
    const signed = signScribeBody({ body: 'Body\n\nCloses #41' });
    const { slice, read } = await askedForPr({ hasPr: true, prBody: signed });
    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: '<<pr-title>>Guard every posting<</pr-title>>',
      hasFailed: false,
    });

    expect(read().editPr).toHaveBeenCalledWith(SESSION_ID, 418, {
      title: 'Guard every posting',
      body: signScribeBody({ body: 'Body\n\nCloses #41' }),
    });
    expect(read().scribeWork[PR_KEY]).toMatchObject({ status: 'created' });
  });

  it('shows why a follow-up could not reach the request and keeps the request linked', async () => {
    const signed = signScribeBody({ body: 'Body' });
    const { slice, read } = await askedForPr({ hasPr: true, prBody: signed });
    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: PROPOSAL,
      hasFailed: false,
    });
    vi.mocked(read().editPr).mockRejectedValueOnce(new Error('HTTP 502 from github'));

    await slice.settleScribe({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      assistantText: '<<pr-title>>Guard every posting<</pr-title>>',
      hasFailed: false,
    });

    expect(read().scribeWork[PR_KEY]).toMatchObject({
      status: 'failed',
      error: 'HTTP 502 from github',
      pullRequest: { number: 418, url: CREATED_URL },
    });
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
