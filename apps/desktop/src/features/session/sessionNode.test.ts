// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { ATTENTION_REASON_META, attentionWordsOf } from './session-stage';
import { sessionNodeOf } from './sessionNode';

type SessionNodeInfo = Parameters<typeof sessionNodeOf>[0]['info'];

const REASONS: ReadonlyArray<SessionAttentionReason> = Object.keys(ATTENTION_REASON_META).filter(
  (key): key is SessionAttentionReason => Object.hasOwn(ATTENTION_REASON_META, key),
);

type NodeOver = Partial<SessionNodeInfo> & { readonly isArchived?: boolean };

const nodeOf = (over: NodeOver = {}) => {
  const { isArchived = false, ...info } = over;
  return sessionNodeOf({
    info: { stage: 'building', attention: null, ...info },
    isArchived,
  });
};

const needing = (attention: SessionAttentionReason, over: NodeOver = {}) =>
  nodeOf({ stage: 'attention', attention, ...over });

describe('the node of a session that needs you', () => {
  it.each(REASONS)('holds %s as its reason', (attention) => {
    expect(needing(attention)).toMatchObject({ kind: 'needs', reason: attention });
  });

  it.each(REASONS)('reads the tone of %s from the reason table', (attention) => {
    expect(needing(attention).tone).toBe(ATTENTION_REASON_META[attention].tone);
  });

  it('says danger only for an agent error, a push that failed, failing checks and a stopped run', () => {
    const danger = REASONS.filter((attention) => needing(attention).tone === 'danger');

    expect(danger).toEqual(['agent-error', 'push-failed', 'ci-failed', 'run-stopped']);
  });

  it.each(REASONS)('describes %s to a screen reader with its words', (attention) => {
    expect(needing(attention).label).toBe(attentionWordsOf({ reason: attention }));
  });

  it('counts the questions and the comments in the words', () => {
    expect(needing('open-question', { openQuestionCount: 3 }).label).toBe('3 questions for you');
    expect(needing('fix-needs-you', { fixNeedsYouCount: 2 }).label).toBe('2 comments need you');
    expect(needing('fix-couldnt-fix', { fixCouldntFixCount: 2 }).label).toBe('2 comments failed');
  });

  it('keeps an unread reply quiet, with the dot instead of a mark', () => {
    expect(needing('unread-reply')).toMatchObject({
      tone: 'info',
      hasUnread: true,
      label: 'New reply',
    });
  });

  it('shows the unread dot on any node when a reply waits among the other reasons', () => {
    expect(needing('pr-approved', { otherReasons: ['unread-reply'] }).hasUnread).toBe(true);
    expect(needing('pr-approved').hasUnread).toBe(false);
  });

  it('keeps a bare needs you stage without a reason', () => {
    expect(nodeOf({ stage: 'attention' })).toMatchObject({
      kind: 'needs',
      reason: null,
      tone: 'warning',
      label: 'Needs you',
    });
  });
});

describe('the node of a session in the merge queue', () => {
  it('holds the queue in the calm primary tone, with its words', () => {
    expect(nodeOf({ stage: 'review', attention: 'pr-queued' })).toMatchObject({
      kind: 'queue',
      reason: 'pr-queued',
      tone: 'primary',
      label: 'In merge queue',
      hasUnread: false,
    });
  });

  it('shows the unread dot while a reply waits behind the queue', () => {
    expect(
      nodeOf({ stage: 'review', attention: 'pr-queued', otherReasons: ['unread-reply'] }).hasUnread,
    ).toBe(true);
  });
});

describe('the node of every other session', () => {
  it('names a running session', () => {
    expect(nodeOf({ stage: 'running', isRunning: true })).toMatchObject({
      kind: 'running',
      reason: null,
      tone: 'info',
      label: 'Running',
    });
  });

  it('names a finished session in the merged tone', () => {
    expect(nodeOf({ stage: 'done' })).toMatchObject({
      kind: 'done',
      tone: 'merged',
      label: 'Done',
      isClosed: false,
    });
  });

  it('keeps the neutral tone for a session whose pull request closed unmerged', () => {
    expect(nodeOf({ stage: 'done', prState: 'closed' })).toMatchObject({
      kind: 'done',
      tone: 'neutral',
      label: 'Done',
      isClosed: true,
    });
  });

  it.each<[SessionStage, string]>([
    ['review', 'In review'],
    ['building', 'Open'],
  ])('names a %s session by its stage', (stage, label) => {
    expect(nodeOf({ stage })).toMatchObject({ kind: 'idle', label });
  });

  it('names an archived session whatever its stage', () => {
    expect(nodeOf({ stage: 'running', isArchived: true })).toMatchObject({
      kind: 'archived',
      label: 'Archived',
    });
    expect(needing('open-question', { isArchived: true }).kind).toBe('archived');
    expect(needing('unread-reply', { isArchived: true }).hasUnread).toBe(false);
  });

  it('shows the unread dot on a running session with a reply waiting', () => {
    expect(nodeOf({ stage: 'running', otherReasons: ['unread-reply'] }).hasUnread).toBe(true);
  });
});
