// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  PrCheckRun,
  ProjectId,
  PullRequestState,
  ResolveThread,
  SessionId,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import {
  clearMobileCreateRateState,
  evaluateMobileCreateSession,
  evaluateMobileMerge,
  evaluateMobileSpawnWorkflow,
  isMergeMethod,
  mobileMergeFacts,
} from './mobileConfinement';
import type { PullRequestFacts } from '../actions/kinds/pullRequestFacts';
import type { SessionGithubState } from '../../store/types';

const sid = (s: string): SessionId => s as SessionId;

// A fully-eligible PR (approved + green + open + non-draft + mergeable). Tests
// override one field at a time to assert each gate independently.
const eligiblePr = (over: Partial<PullRequestState> = {}): PullRequestState => ({
  number: 7,
  title: 'feat: thing',
  url: 'https://github.com/x/y/pull/7',
  state: 'approved',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feat/thing',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-06-22T00:00:00Z',
  ...over,
});

describe('isMergeMethod', () => {
  it('accepts only the closed squash|merge|rebase set', () => {
    for (const m of ['squash', 'merge', 'rebase']) {
      expect(isMergeMethod(m)).toBe(true);
    }
    for (const m of ['', 'SQUASH', 'fast-forward', 'delete', 42, null, undefined, {}]) {
      expect(isMergeMethod(m)).toBe(false);
    }
  });
});

const NOW = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const githubOf = ({
  pr,
  checks,
}: {
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
}): SessionGithubState => ({
  pr,
  linkedIssues: [],
  fetchedAt: NOW,
  failedAt: null,
  loading: false,
  error: null,
  detail:
    checks === null
      ? null
      : {
          prNumber: pr?.number ?? 0,
          comments: [],
          reviews: [],
          reviewRequests: [],
          checks,
          checksRead: 'ok',
        },
  detailFetchedAt: checks === null ? null : NOW,
  detailLoading: false,
  detailError: null,
});

const factsOf = ({
  pr = eligiblePr(),
  checks = null,
  threads = [],
}: {
  readonly pr?: PullRequestState | null;
  readonly checks?: ReadonlyArray<PrCheckRun> | null;
  readonly threads?: ReadonlyArray<ResolveThread>;
} = {}): PullRequestFacts =>
  mobileMergeFacts({
    state: {
      sessionGithub: { [sid('s1')]: githubOf({ pr, checks }) },
      sessionResolveThreads: { [sid('s1')]: threads },
      sessionResolveAttempts: {},
    },
    sessionId: sid('s1'),
  });

const run = (name: PrCheckRun['name'], conclusion: PrCheckRun['conclusion']): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

const thread = (state: ResolveThread['state']): ResolveThread => ({
  id: `thread-${state}`,
  sessionId: sid('s1'),
  projectId: null,
  prNumber: 7,
  threadId: `PRT_${state}`,
  originKind: 'review_comment',
  diffCommentId: null,
  state,
  stage: state === 'working' ? 'working' : 'asking',
  stateReason: null,
  revision: 1,
  generation: 1,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: null,
  replyDraft: null,
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
});

describe('evaluateMobileMerge', () => {
  it('permits an approved, green, mergeable PR with every supported method', () => {
    const facts = factsOf();
    expect(evaluateMobileMerge({ facts, method: 'squash' })).toEqual({
      ok: true,
      pr: facts.pr,
      method: 'squash',
    });
    expect(evaluateMobileMerge({ facts, method: 'merge' }).ok).toBe(true);
    expect(evaluateMobileMerge({ facts, method: 'rebase' }).ok).toBe(true);
  });

  it('permits a repo with no required review and no CI', () => {
    const gate = evaluateMobileMerge({
      facts: factsOf({ pr: eligiblePr({ reviewDecision: null, checks: null }) }),
      method: 'squash',
    });
    expect(gate.ok).toBe(true);
  });

  it('refuses an unsupported method even when the PR is eligible', () => {
    expect(evaluateMobileMerge({ facts: factsOf(), method: 'fast-forward' })).toEqual({
      ok: false,
      reason: 'unsupported merge method: fast-forward',
    });
  });

  it('refuses when there is no PR for the session', () => {
    expect(evaluateMobileMerge({ facts: factsOf({ pr: null }), method: 'squash' }).ok).toBe(false);
    expect(evaluateMobileMerge({ facts: null, method: 'squash' }).ok).toBe(false);
    expect(evaluateMobileMerge({ facts: undefined, method: 'squash' }).ok).toBe(false);
  });

  it.each([
    [{ isDraft: true }, 'Mark this pull request ready before merging.'],
    [{ state: 'merged' }, 'This pull request is already merged.'],
    [{ state: 'closed' }, 'Reopen this pull request before merging.'],
    [{ state: 'queued' }, 'GitHub is already set to merge this pull request.'],
    [{ mergeable: false }, 'Conflicts with main. Rebase on main from the Branch header.'],
    [{ reviewDecision: 'review_required' }, 'Needs an approving review.'],
    [{ reviewDecision: 'changes_requested' }, 'A reviewer asked for changes.'],
    [{ checks: 'failure' }, '1 check failing.'],
    [{ checks: 'pending' }, 'Checks are still running.'],
  ] as const satisfies ReadonlyArray<readonly [Partial<PullRequestState>, string]>)(
    'refuses %j with the desktop reason',
    (over, reason) => {
      const facts = factsOf({ pr: eligiblePr(over) });
      const gate = evaluateMobileMerge({ facts, method: 'squash' });
      expect(gate).toEqual({ ok: false, reason });
    },
  );

  it('refuses while GitHub has not finished checking mergeability', () => {
    expect(
      evaluateMobileMerge({
        facts: factsOf({ pr: eligiblePr({ mergeable: null }) }),
        method: 'squash',
      }),
    ).toEqual({
      ok: false,
      reason: 'GitHub has not finished checking whether this branch merges.',
    });
  });

  it('names the failing and the running checks the way the desktop does', () => {
    expect(
      evaluateMobileMerge({
        facts: factsOf({ checks: [run('unit tests', 'failure'), run('lint', 'success')] }),
        method: 'squash',
      }),
    ).toEqual({ ok: false, reason: '1 check failing: unit tests.' });
    expect(
      evaluateMobileMerge({
        facts: factsOf({ checks: [run('unit tests', 'pending'), run('lint', 'pending')] }),
        method: 'squash',
      }),
    ).toEqual({ ok: false, reason: '2 checks still running.' });
  });

  it('refuses while comments wait for the owner or a fix run is live', () => {
    expect(
      evaluateMobileMerge({
        facts: factsOf({ threads: [thread('needs_answer'), thread('needs_answer')] }),
        method: 'squash',
      }),
    ).toEqual({ ok: false, reason: '2 comments need you' });
    expect(
      evaluateMobileMerge({ facts: factsOf({ threads: [thread('working')] }), method: 'squash' }),
    ).toEqual({ ok: false, reason: 'A run is live on this branch' });
  });
});

describe('evaluateMobileCreateSession', () => {
  // Trusted server-side state the gate validates against. The phone's claims
  // (workspaceId/provider) are tested against THESE, never trusted directly.
  const workspaces = [{ id: 'w1' as WorkspaceId }, { id: 'w2' as WorkspaceId }];
  const linearOnW1 = [{ provider: 'linear' as const }];
  const oneProject = [{ id: 'p-api' as ProjectId, name: 'api' }];
  const twoProjects = [
    { id: 'p-api' as ProjectId, name: 'api' },
    { id: 'p-web' as ProjectId, name: 'web' },
  ];

  afterEach(() => clearMobileCreateRateState());

  it('accepts a known workspace with the provider connected', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.workspaceId).toBe('w1');
      expect(gate.provider).toBe('linear');
      expect(gate.projectId).toBe('p-api');
    }
  });

  it('returns the requested project when it belongs to the workspace', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      projectId: 'p-web',
      workspaces,
      projects: twoProjects,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(true);
    if (gate.ok) expect(gate.projectId).toBe('p-web');
  });

  it('refuses a project id the workspace does not hold', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      projectId: 'p-evil',
      workspaces,
      projects: twoProjects,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/unknown project for this workspace: p-evil/i);
  });

  it('refuses several projects with no pick, naming the choice and listing the options', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      projects: twoProjects,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.reason).toMatch(/several projects/i);
      expect(gate.reason).toMatch(/projectId/);
      expect(gate.reason).toContain('api (p-api)');
      expect(gate.reason).toContain('web (p-web)');
    }
  });

  it('refuses a workspace with no project at all', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      projects: [],
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/no project/i);
  });

  it('never burns a rate slot on a project refusal', () => {
    for (let i = 0; i < 5; i += 1) {
      const refused = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        projects: twoProjects,
        integrations: linearOnW1,
        now: 5_000,
      });
      expect(refused.ok).toBe(false);
    }
    const unknown = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      projectId: 'p-evil',
      workspaces,
      projects: twoProjects,
      integrations: linearOnW1,
      now: 5_000,
    });
    expect(unknown.ok).toBe(false);
    for (let i = 0; i < 5; i += 1) {
      const next = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        projects: oneProject,
        integrations: linearOnW1,
        now: 5_000,
      });
      expect(next.ok).toBe(true);
      if (next.ok) next.reservation.commit(5_000);
    }
  });

  it('refuses a missing workspaceId', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: undefined,
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/workspaceId/i);
  });

  it('refuses an unsupported provider', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'github',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/provider/i);
  });

  // ADVERSARIAL: a lying phone claims a workspaceId the desktop does not have.
  it('refuses a forged/disallowed workspaceId (not in the trusted list)', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w-evil',
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/unknown workspace/i);
  });

  // ADVERSARIAL: target a real workspace but a provider that isn't connected
  // there — the desktop has no credential to resolve the issue, so refuse.
  it('refuses a provider that is not connected for the target workspace', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'sentry', // only linear is connected on w1
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/not connected/i);
  });

  // PARITY: jira must pass through the exact same gate shape as linear —
  // adding a provider to the allowlist is not a special case, it is another
  // member of the same set.
  it('accepts jira exactly as it accepts linear (same connected-workspace shape)', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'jira',
      workspaces,
      projects: oneProject,
      integrations: [{ provider: 'jira' as const }],
    });
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.workspaceId).toBe('w1');
      expect(gate.provider).toBe('jira');
    }
  });

  // PARITY: an unconnected jira integration is refused the same way an
  // unconnected linear integration is refused above.
  it('refuses jira when it is not connected for the target workspace', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'jira',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1, // only linear connected on w1
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/not connected/i);
  });

  // PARITY: bitbucket and slack remain outside the create-session allowlist,
  // same refusal shape as any other unsupported provider (e.g. github).
  it('refuses bitbucket and slack exactly as it refuses github', () => {
    for (const provider of ['bitbucket', 'slack']) {
      const gate = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider,
        workspaces,
        projects: oneProject,
        integrations: [{ provider: provider as never }],
      });
      expect(gate.ok).toBe(false);
      if (!gate.ok) expect(gate.reason).toMatch(/unsupported provider/i);
    }
  });

  // ADVERSARIAL: w2 exists but has no integrations at all — can't launch from it.
  it('refuses a workspace with no integrations connected', () => {
    const gate = evaluateMobileCreateSession({
      workspaceId: 'w2',
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: [], // w2 has nothing wired up
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/not connected/i);
  });

  it('rate-limits a burst of launches (abuse guard)', () => {
    const ok = () => {
      const g = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        projects: oneProject,
        integrations: linearOnW1,
        now: 1_000,
      });
      // The gate reserves the slot up front; committing turns it into a counted
      // launch (matches the executor's commit-on-success path).
      if (g.ok) g.reservation.commit(1_000);
      return g.ok;
    };
    // First five within the window pass; the sixth is throttled.
    for (let i = 0; i < 5; i += 1) {
      expect(ok()).toBe(true);
    }
    const sixth = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
      now: 1_000,
    });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.reason).toMatch(/too many|slow down/i);

    // After the window slides, launches are allowed again.
    const later = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
      now: 1_000 + 61_000,
    });
    expect(later.ok).toBe(true);
  });

  // SECURITY (TOCTOU): a pipelined burst arriving in the same tick must NOT all
  // pass the gate. The reservation is counted against the cap synchronously, so
  // even with NO create having resolved yet, the 6th concurrent gate is refused.
  it('counts in-flight reservations against the cap (no concurrent bypass)', () => {
    const gate = () =>
      evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        projects: oneProject,
        integrations: linearOnW1,
        now: 2_000,
      });
    // Five concurrent gates pass and HOLD their reservations (no commit yet —
    // simulating five long createSession ops still in flight).
    const held = [];
    for (let i = 0; i < 5; i += 1) {
      const g = gate();
      expect(g.ok).toBe(true);
      if (g.ok) held.push(g.reservation);
    }
    // Sixth concurrent gate is refused purely on pending reservations, even
    // though zero creates have completed (mobileCreateTimestamps is empty).
    const sixth = gate();
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.reason).toMatch(/too many|slow down/i);

    // Releasing one reservation (a failed create) frees a slot for a retry.
    held[0]!.release();
    const retry = gate();
    expect(retry.ok).toBe(true);
  });

  // A released reservation must not consume a slot OR throw on double-settle.
  it('releases a reserved slot without recording a launch; settle is idempotent', () => {
    const g = evaluateMobileCreateSession({
      workspaceId: 'w1',
      provider: 'linear',
      workspaces,
      projects: oneProject,
      integrations: linearOnW1,
      now: 3_000,
    });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    g.reservation.release();
    // Double-settle is a no-op (commit after release does nothing).
    g.reservation.commit(3_000);
    // Slot was freed: a full burst of five fresh launches still fits.
    for (let i = 0; i < 5; i += 1) {
      const next = evaluateMobileCreateSession({
        workspaceId: 'w1',
        provider: 'linear',
        workspaces,
        projects: oneProject,
        integrations: linearOnW1,
        now: 3_000,
      });
      expect(next.ok).toBe(true);
      if (next.ok) next.reservation.commit(3_000);
    }
  });
});

describe('evaluateMobileSpawnWorkflow (server-side gate)', () => {
  const sessions = [
    { id: sid('s1'), workspaceId: 'w1' as WorkspaceId },
    { id: sid('s2'), workspaceId: 'w2' as WorkspaceId },
  ];
  const w1Workflows = [{ id: 'wf-a' as WorkflowId }, { id: 'wf-b' as WorkflowId }];

  it('passes for a known session + a workflow in that session workspace', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 's1',
      workflowId: 'wf-a',
      sessions,
      workflowsForWorkspace: w1Workflows,
    });
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.sessionId).toBe('s1');
      expect(gate.workflowId).toBe('wf-a');
    }
  });

  it('refuses a missing sessionId', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: '',
      workflowId: 'wf-a',
      sessions,
      workflowsForWorkspace: w1Workflows,
    });
    expect(gate).toMatchObject({ ok: false });
  });

  it('refuses a missing workflowId', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 's1',
      workflowId: undefined,
      sessions,
      workflowsForWorkspace: w1Workflows,
    });
    expect(gate).toMatchObject({ ok: false });
  });

  it('refuses an unknown (forged) session id', () => {
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 'nope',
      workflowId: 'wf-a',
      sessions,
      workflowsForWorkspace: w1Workflows,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/unknown session/);
  });

  it('refuses a workflow that is not in the session workspace', () => {
    // caller passes only the session's own workspace templates; a cross-workspace
    // workflow id is therefore absent and refused.
    const gate = evaluateMobileSpawnWorkflow({
      sessionId: 's1',
      workflowId: 'wf-from-w2',
      sessions,
      workflowsForWorkspace: w1Workflows,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/unknown workflow/);
  });
});
