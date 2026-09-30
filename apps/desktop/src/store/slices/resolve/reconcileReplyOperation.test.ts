// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrComment, ResolvePublicationThread } from '@goodboy/types';
import { reconcileReplyOperation } from './reconcileReplyOperation';

const ATTEMPTED_AT = 1_700_000_000_000;

const thread: ResolvePublicationThread = {
  publicationId: 'pub-1',
  threadId: 'PRRT_1',
  revision: 1,
  priorState: 'answered',
  sourceFingerprint: 'abc',
  operationId: 'op-1',
  replyBody: 'Already handled elsewhere',
  replyPhase: 'uncertain',
  replyId: null,
  replyAttemptedAt: ATTEMPTED_AT,
  replyPostedAt: null,
  resolvePhase: 'uncertain',
  resolvedAt: null,
  error: 'network timeout',
};

const aComment = (overrides: Partial<PrComment>): PrComment => ({
  id: 'comment-1',
  author: 'iokafor',
  authorAvatarUrl: null,
  body: 'Already handled elsewhere',
  createdAt: new Date(ATTEMPTED_AT + 500).toISOString(),
  url: 'https://github.com/acme/payments-api/pull/318#discussion_r1',
  threadId: 'PRRT_1',
  source: 'review',
  ...overrides,
});

const commentOf = ({ id }: { readonly id: string }): PrComment => aComment({ id });

describe('reconcileReplyOperation', () => {
  it('calls one matching reply posted', () => {
    expect(
      reconcileReplyOperation({
        thread,
        comments: [commentOf({ id: 'c1' })],
        observedAt: ATTEMPTED_AT + 1000,
        isObservationTrusted: true,
      }),
    ).toBe('posted');
  });

  it('calls an empty thread not posted, so a retry is safe', () => {
    expect(
      reconcileReplyOperation({
        thread,
        comments: [],
        observedAt: ATTEMPTED_AT + 1000,
        isObservationTrusted: true,
      }),
    ).toBe('not_posted');
  });

  it('refuses to decide when two identical replies are already there', () => {
    expect(
      reconcileReplyOperation({
        thread,
        comments: [commentOf({ id: 'c1' }), commentOf({ id: 'c2' })],
        observedAt: ATTEMPTED_AT + 1000,
        isObservationTrusted: true,
      }),
    ).toBe('ambiguous');
  });

  it('refuses to decide on an observation older than the attempt', () => {
    expect(
      reconcileReplyOperation({
        thread,
        comments: [],
        observedAt: ATTEMPTED_AT - 1000,
        isObservationTrusted: true,
      }),
    ).toBe('ambiguous');
  });

  it('refuses to decide when the pull request could not be read', () => {
    expect(
      reconcileReplyOperation({
        thread,
        comments: [],
        observedAt: ATTEMPTED_AT + 1000,
        isObservationTrusted: false,
      }),
    ).toBe('ambiguous');
  });
  describe('a reply the user wrote by hand', () => {
    const handReply = (overrides: Partial<PrComment>): PrComment =>
      aComment({
        id: 'hand-1',
        author: 'Mquint',
        body: 'Done, thanks for the catch',
        ...overrides,
      });
    const head = aComment({
      id: 'head',
      author: 'iokafor',
      body: 'Please cap this',
      createdAt: new Date(ATTEMPTED_AT - 5000).toISOString(),
    });

    it('is recognised even when the text differs from the draft', () => {
      expect(
        reconcileReplyOperation({
          thread,
          comments: [head, handReply({})],
          observedAt: ATTEMPTED_AT + 1000,
          isObservationTrusted: true,
          viewerLogins: new Set(['mquint']),
        }),
      ).toBe('posted');
    });

    it('is not mistaken for the reviewer or for an earlier reply', () => {
      expect(
        reconcileReplyOperation({
          thread,
          comments: [head, handReply({ author: 'iokafor' })],
          observedAt: ATTEMPTED_AT + 1000,
          isObservationTrusted: true,
          viewerLogins: new Set(['mquint']),
        }),
      ).toBe('not_posted');
      expect(
        reconcileReplyOperation({
          thread,
          comments: [head, handReply({ createdAt: new Date(ATTEMPTED_AT - 100).toISOString() })],
          observedAt: ATTEMPTED_AT + 1000,
          isObservationTrusted: true,
          viewerLogins: new Set(['mquint']),
        }),
      ).toBe('not_posted');
    });
  });
});
