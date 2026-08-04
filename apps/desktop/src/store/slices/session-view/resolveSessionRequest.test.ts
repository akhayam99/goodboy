import { describe, expect, it } from 'vitest';
import type { PullRequestState, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { deriveSessionStage } from './deriveSessionStage';
import { resolveSessionRequest } from './resolveSessionRequest';

const DATE = '2026-08-04T00:00:00.000Z';

const session: Session = {
  id: 'session-1' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Refactor authentication',
  state: { kind: 'idle', lastActivityAt: DATE as Session['createdAt'] },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE as Session['createdAt'],
  updatedAt: DATE as Session['updatedAt'],
};

type MrParams = {
  readonly overrides?: Partial<GitlabMergeRequest>;
};

const makeMr = ({ overrides = {} }: MrParams): GitlabMergeRequest => ({
  id: 100,
  iid: 7,
  projectId: 3,
  title: 'Refactor authentication',
  description: 'Refactors authentication.',
  state: 'merged',
  webUrl: 'https://gitlab.com/acme/goodboy/-/merge_requests/7',
  sourceBranch: 'ak/refactor-auth',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: DATE,
  ...overrides,
});

type PrParams = {
  readonly overrides?: Partial<PullRequestState>;
};

const makePr = ({ overrides = {} }: PrParams): PullRequestState => ({
  number: 42,
  title: 'Refactor authentication',
  url: 'https://github.com/acme/goodboy/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/refactor-auth',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: DATE,
  ...overrides,
});

describe('resolveSessionRequest', () => {
  it('completes a session that only ever had a merged GitLab merge request', () => {
    const request = resolveSessionRequest({ pr: null, mr: makeMr({}) });
    const info = deriveSessionStage({
      session,
      pr: request.pr,
      requestLabel: request.requestLabel,
      hasUnread: false,
      openQuestionCount: 0,
    });
    expect(info).toEqual({ stage: 'done', reason: 'MR !7 merged' });
  });

  it('lets the GitHub pull request win when both hosts answer', () => {
    const request = resolveSessionRequest({ pr: makePr({}), mr: makeMr({}) });
    const info = deriveSessionStage({
      session,
      pr: request.pr,
      requestLabel: request.requestLabel,
      hasUnread: false,
      openQuestionCount: 0,
    });
    expect(info).toEqual({ stage: 'review', reason: 'PR #42 awaiting review' });
  });

  it('never reads CI from a merge request', () => {
    const request = resolveSessionRequest({
      pr: null,
      mr: makeMr({ overrides: { state: 'opened' } }),
    });
    expect(request.pr?.checks).toBeNull();
    expect(request.pr?.reviewDecision).toBeNull();
  });
});
