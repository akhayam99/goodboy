// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProjectId,
  type ProviderRunId,
  type PullRequestState,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { MountBitbucketPrState } from '../../../store/slices/mount-request/state';
import { aMountView } from '../testing/aMountView';
import { aProjectMountOf } from '../testing/aProjectMountOf';
import { collectAskPackInput } from './collectAskPackInput';

const SESSION = 'session-harborline' as SessionId;
const PROJECT = 'project-payments-api' as ProjectId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const pullRequestOf = (over: Partial<PullRequestState>): PullRequestState => ({
  number: 9914,
  title: 'Encode signup intents as opaque aliases',
  url: 'https://github.com/harborline/payments-api/pull/9914',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'harborline/opaque-aliases',
  isDraft: false,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: '2026-10-06T14:56:25Z' as IsoDateTime,
  ...over,
});

const seedPullRequest = (pr: PullRequestState) => {
  useAppStore.setState({
    sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
    sessionProjectPrs: { [SESSION]: { [PROJECT]: [pr] } },
  });
};

describe('collectAskPackInput', () => {
  it('hands the ask pack a closed pull request as closed, never as a draft', () => {
    seedPullRequest(pullRequestOf({ state: 'closed', isDraft: true }));

    const input = collectAskPackInput({
      state: useAppStore.getState(),
      sessionId: SESSION,
      rightNow: [],
    });

    expect(input.pullRequest?.state).toBe('closed');
  });

  it('hands the ask pack a live draft as a draft', () => {
    seedPullRequest(pullRequestOf({ state: 'draft', isDraft: true }));

    const input = collectAskPackInput({
      state: useAppStore.getState(),
      sessionId: SESSION,
      rightNow: [],
    });

    expect(input.pullRequest?.state).toBe('draft');
  });

  it('hands the ask pack the last ten tool calls of a running agent and every script run', () => {
    const agentId = brandId<AgentId>({ value: 'agent-implementer' });
    const runId = brandId<ProviderRunId>({ value: 'run-1' });
    const at = brandId<IsoDateTime>({ value: '2026-10-06T14:56:25Z' });
    const calls: ReadonlyArray<TurnEvent> = Array.from({ length: 12 }, (_, index) => ({
      kind: 'tool_call_start',
      runId,
      toolUseId: `tool-${index}`,
      toolName: 'Bash',
      input: { command: `pnpm test step-${index}` },
      at,
    }));
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
      sessionPhaseRuns: {
        [SESSION]: [
          anAgent({ id: agentId, sessionId: SESSION, name: 'Implementer', status: 'running' }),
        ],
      },
      transcripts: {
        [agentId]: [
          ...calls,
          { kind: 'tool_call_end', runId, toolUseId: 'tool-11', output: '', isError: true, at },
        ],
      },
      scriptRuns: {
        [SESSION]: {
          test: {
            status: 'error',
            result: { stdout: '2 failed', stderr: '', exitCode: 1 },
            runId: 'script-run-1',
            startedAt: 0,
            name: 'test',
          },
        },
      },
    });

    const input = collectAskPackInput({
      state: useAppStore.getState(),
      sessionId: SESSION,
      rightNow: [],
    });

    expect(input.live.calls).toEqual([
      {
        agent: 'Implementer',
        calls: [
          ...Array.from({ length: 9 }, (_, index) => `Bash pnpm test step-${index + 2}`),
          'Bash pnpm test step-11 (failed)',
        ],
      },
    ]);
    expect(input.live.scripts).toEqual([
      { project: null, name: 'test', outcome: 'failed with exit code 1', output: '2 failed' },
    ]);
  });

  it('redacts a whole tool call before it is cut, so no secret fragment crosses the cut', () => {
    const agentId = brandId<AgentId>({ value: 'agent-implementer' });
    const runId = brandId<ProviderRunId>({ value: 'run-1' });
    const at = brandId<IsoDateTime>({ value: '2026-10-06T14:56:25Z' });
    const commands = [
      `${'x'.repeat(150)} ghp_abcdefghijklmnopqrstuvwxyz123456`,
      `${'x'.repeat(120)} https://deploy:harborlinedeploysecretvalue1@github.com/acme/ledger-core`,
    ];
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
      sessionPhaseRuns: {
        [SESSION]: [
          anAgent({ id: agentId, sessionId: SESSION, name: 'Implementer', status: 'running' }),
        ],
      },
      transcripts: {
        [agentId]: commands.map((command, index) => ({
          kind: 'tool_call_start',
          runId,
          toolUseId: `tool-${index}`,
          toolName: 'Bash',
          input: { command },
          at,
        })),
      },
    });

    const calls = collectAskPackInput({
      state: useAppStore.getState(),
      sessionId: SESSION,
      rightNow: [],
    }).live.calls.flatMap((entry) => entry.calls);

    expect(calls).toHaveLength(2);
    expect(calls.join('\n')).not.toContain('ghp_');
    expect(calls.join('\n')).not.toContain('harborlinedeploysecret');
  });

  it('reads the checks of a Bitbucket pull request from its mount request', () => {
    const view = aMountView({
      key: 'ledger',
      sessionId: SESSION,
      projectId: PROJECT,
      projectName: 'ledger-core',
      branch: 'ak/limits',
    });
    const bitbucket: MountBitbucketPrState = {
      kind: 'bitbucket',
      selected: null,
      mountId: view.id,
      projectId: PROJECT,
      revision: 1,
      host: 'bitbucket.org',
      repo: null,
      repository: 'acme/ledger-core',
      branch: 'ak/limits',
      prs: [],
      links: [],
      checks: 'failure',
      reviewDecision: null,
      pr: {
        id: 21,
        title: 'Per-tenant limits on payouts',
        description: '',
        state: 'OPEN',
        createdOn: '2026-10-06T14:56:25Z',
        updatedOn: '2026-10-06T14:56:25Z',
        sourceBranch: 'ak/limits',
        sourceCommit: null,
        destinationBranch: 'main',
        destinationCommit: null,
        author: null,
        reviewers: [],
        participants: [],
        closeSourceBranch: false,
        mergeCommit: null,
        commentCount: 0,
        taskCount: 0,
        webUrl: null,
      },
      fetchedAt: brandId<IsoDateTime>({ value: '2026-10-06T14:56:25Z' }),
      loading: false,
      error: null,
    };
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, goal: 'Opaque signup aliases' })],
      sessionProjectMounts: { [SESSION]: [aProjectMountOf({ view })] },
      mountRequests: { [view.id]: bitbucket },
    });

    const input = collectAskPackInput({
      state: useAppStore.getState(),
      sessionId: SESSION,
      rightNow: [],
    });

    expect(input.live.checks).toEqual([
      { project: 'ledger-core', name: 'on PR #21', outcome: 'failed' },
    ]);
  });
});
