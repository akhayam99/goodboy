// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProjectId, PullRequestState, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
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
});
