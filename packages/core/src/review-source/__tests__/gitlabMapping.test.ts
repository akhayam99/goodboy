import { describe, expect, it } from 'vitest';
import {
  gitlabDiscussionId,
  gitlabThreadId,
  gitlabThreadsOf,
  type GitlabReviewDiscussion,
} from '../gitlabReviewSource';
import { commitLinkOf } from '../commitLink';
import { localReviewSource, LOCAL_NOTE_NO_REPLY } from '../localReviewSource';
import { REVIEW_SOURCE_CAPABILITIES } from '../types';

const note = (overrides: Partial<GitlabReviewDiscussion['notes'][number]> = {}) => ({
  id: 1,
  body: 'Use the template name',
  system: false,
  author: { username: 'ines', name: 'Ines Okafor', avatarUrl: null },
  createdAt: '2026-01-01T10:00:00Z',
  resolvable: true,
  resolved: false,
  position: { newPath: 'src/relay/templates.ts', oldPath: null, newLine: 21, oldLine: null },
  ...overrides,
});

describe('gitlabThreadsOf', () => {
  it('marks a discussion resolved only when every resolvable note is resolved', () => {
    const threads = gitlabThreadsOf({
      mrUrl: null,
      discussions: [
        {
          id: 'a',
          individualNote: false,
          notes: [note({ resolved: true }), note({ id: 2, resolved: false })],
        },
        {
          id: 'b',
          individualNote: false,
          notes: [note({ resolved: true }), note({ id: 3, resolved: true })],
        },
      ],
    });
    expect(threads.map((thread) => thread.isResolved)).toEqual([false, true]);
  });

  it('skips discussions with no resolvable note and drops system notes', () => {
    const threads = gitlabThreadsOf({
      mrUrl: null,
      discussions: [
        { id: 'plain', individualNote: true, notes: [note({ resolvable: false })] },
        {
          id: 'diff',
          individualNote: false,
          notes: [note(), note({ id: 2, system: true, resolvable: false })],
        },
      ],
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]?.comments).toHaveLength(1);
  });

  it('links each comment to its note on the merge request', () => {
    const [thread] = gitlabThreadsOf({
      mrUrl: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
      discussions: [{ id: 'a', individualNote: false, notes: [note({ id: 77 })] }],
    });
    expect(thread?.comments[0]?.url).toBe(
      'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57#note_77',
    );
  });

  it('namespaces the thread id and gives the discussion id back', () => {
    expect(gitlabDiscussionId({ threadId: gitlabThreadId({ discussionId: 'd41' }) })).toBe('d41');
  });
});

describe('localReviewSource', () => {
  it('resolves by closing the note and cannot reply', async () => {
    const closed: Array<string> = [];
    const source = localReviewSource({
      closeNote: async ({ threadId }) => {
        closed.push(threadId);
      },
    });
    await source.resolve({ providerThreadId: 'note:1' });
    expect(closed).toEqual(['note:1']);
    expect(source.capabilities.canReply).toBe(false);
    await expect(source.reply({ providerThreadId: 'note:1', body: 'x' })).rejects.toThrow(
      LOCAL_NOTE_NO_REPLY,
    );
  });
});

describe('commitLinkOf', () => {
  it('links a commit on each provider and nothing for the rest', () => {
    expect(
      commitLinkOf({
        kind: 'github',
        url: 'https://github.com/harborline/payments-api/pull/318',
        sha: 'abc1234',
      }),
    ).toBe('https://github.com/harborline/payments-api/commit/abc1234');
    expect(
      commitLinkOf({
        kind: 'gitlab',
        url: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
        sha: 'def5678',
      }),
    ).toBe('https://gitlab.example.com/harborline/notify-relay/-/commit/def5678');
    expect(commitLinkOf({ kind: 'local', url: null, sha: 'abc1234' })).toBeNull();
  });
});

describe('REVIEW_SOURCE_CAPABILITIES', () => {
  it('lets bitbucket reply without resolving', () => {
    expect(REVIEW_SOURCE_CAPABILITIES.bitbucket).toMatchObject({
      canReply: true,
      canResolve: false,
    });
    expect(REVIEW_SOURCE_CAPABILITIES.local.canReply).toBe(false);
  });

  it('writes the pull request on GitHub and GitLab and the Bitbucket subset', () => {
    for (const kind of ['github', 'gitlab'] as const) {
      expect(REVIEW_SOURCE_CAPABILITIES[kind]).toMatchObject({
        canEditTitle: true,
        canEditBody: true,
        canRequestReviewers: true,
        canSetDraft: true,
        canReadChecks: true,
        canChooseMergeMethod: true,
        canClose: true,
        canReopen: true,
      });
    }
    expect(REVIEW_SOURCE_CAPABILITIES.bitbucket).toMatchObject({
      canEditTitle: true,
      canEditBody: true,
      canRequestReviewers: true,
      canSetDraft: false,
      canReadChecks: true,
      canChooseMergeMethod: true,
      canClose: true,
      canReopen: false,
    });
    for (const kind of ['local'] as const) {
      expect(REVIEW_SOURCE_CAPABILITIES[kind]).toMatchObject({
        canEditTitle: false,
        canEditBody: false,
        canRequestReviewers: false,
        canSetDraft: false,
        canReadChecks: false,
        canChooseMergeMethod: false,
        canClose: false,
        canReopen: false,
      });
    }
  });
});
