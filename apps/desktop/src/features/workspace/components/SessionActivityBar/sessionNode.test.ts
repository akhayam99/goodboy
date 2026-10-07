// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../../session/session-stage';
import { sessionNodeOf } from './sessionNode';

type SessionNodeInfo = Parameters<typeof sessionNodeOf>[0]['info'];

const REASONS = Object.keys(ATTENTION_REASON_META) as ReadonlyArray<SessionAttentionReason>;

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
  it.each<[SessionAttentionReason, string]>([
    ['agent-error', 'failed'],
    ['ci-failed', 'failed'],
    ['open-question', 'question'],
    ['fix-needs-you', 'question'],
    ['needs-approval', 'approval'],
    ['plan-approval', 'approval'],
    ['changes-requested', 'alert'],
    ['fix-couldnt-fix', 'alert'],
    ['pr-approved', 'approved'],
    ['unread-reply', 'marker'],
  ])('draws %s as the %s node', (attention, state) => {
    expect(needing(attention)).toMatchObject({ kind: 'needs', state });
  });

  it.each(REASONS)('reads the tone of %s from the reason table', (attention) => {
    expect(needing(attention).tone).toBe(ATTENTION_REASON_META[attention].tone);
  });

  it('says danger only for an agent error and failing checks', () => {
    const danger = REASONS.filter((attention) => needing(attention).tone === 'danger');

    expect(danger).toEqual(['agent-error', 'ci-failed']);
  });

  it('draws a pull request waiting to merge as a solid approval, never as a failure', () => {
    expect(needing('pr-approved')).toMatchObject({ state: 'approved', tone: 'success' });
    expect(needing('changes-requested')).toMatchObject({ state: 'alert', tone: 'warning' });
    expect(needing('fix-couldnt-fix')).toMatchObject({ state: 'alert', tone: 'warning' });
  });

  it.each(REASONS)('describes %s to a screen reader with its words', (attention) => {
    expect(needing(attention).label).toBe(attentionWordsOf({ reason: attention }));
  });

  it('counts the questions and the comments in the words', () => {
    expect(needing('open-question', { openQuestionCount: 3 }).label).toBe('3 questions for you');
    expect(needing('fix-needs-you', { fixNeedsYouCount: 2 }).label).toBe('2 comments need you');
    expect(needing('fix-couldnt-fix', { fixCouldntFixCount: 2 }).label).toBe(
      "2 comments it couldn't fix",
    );
  });

  it('keeps an unread reply as a quiet ring with the row dot instead of a mark', () => {
    expect(needing('unread-reply')).toMatchObject({
      state: 'marker',
      tone: 'info',
      hasUnread: true,
      label: 'New reply',
    });
  });

  it('spins the ring only when an agent works while the reason holds the session', () => {
    expect(needing('open-question').isSpinning).toBe(false);
    expect(needing('open-question', { isRunning: true })).toMatchObject({
      state: 'question',
      isSpinning: true,
    });
  });

  it('shows the unread dot on any node when a reply waits among the other reasons', () => {
    expect(needing('pr-approved', { otherReasons: ['unread-reply'] }).hasUnread).toBe(true);
    expect(needing('pr-approved').hasUnread).toBe(false);
  });

  it('keeps a bare needs you stage on the question node', () => {
    expect(nodeOf({ stage: 'attention' })).toMatchObject({
      kind: 'needs',
      state: 'question',
      tone: 'warning',
      label: 'Needs you',
    });
  });
});

describe('the node of every other session', () => {
  it('draws a running session with the running ring', () => {
    expect(nodeOf({ stage: 'running', isRunning: true })).toMatchObject({
      kind: 'running',
      state: 'running',
      tone: 'info',
      label: 'Running',
      isSpinning: false,
    });
  });

  it('draws a finished session as the muted check', () => {
    expect(nodeOf({ stage: 'done' })).toMatchObject({
      kind: 'done',
      state: 'closed',
      label: 'Done',
    });
  });

  it.each<[SessionStage, string]>([
    ['review', 'In review'],
    ['building', 'Building'],
  ])('draws a %s session as a quiet ring named by its stage', (stage, label) => {
    expect(nodeOf({ stage })).toMatchObject({ kind: 'idle', state: 'marker', label });
  });

  it('draws an archived session as the dashed ring whatever its stage', () => {
    expect(nodeOf({ stage: 'running', isArchived: true })).toMatchObject({
      kind: 'archived',
      state: 'queued',
      label: 'Archived',
    });
    expect(needing('open-question', { isArchived: true }).kind).toBe('archived');
    expect(needing('unread-reply', { isArchived: true }).hasUnread).toBe(false);
  });

  it('never draws a glyph on the quiet, done or archived nodes beyond their own', () => {
    expect(nodeOf({ stage: 'building' }).mark).toEqual({ kind: 'glyph', glyph: null });
    expect(nodeOf({ stage: 'done' }).mark).toEqual({ kind: 'glyph', glyph: null });
    expect(nodeOf({ isArchived: true }).mark).toEqual({ kind: 'glyph', glyph: null });
  });

  it('shows the unread dot on a running session with a reply waiting', () => {
    expect(nodeOf({ stage: 'running', otherReasons: ['unread-reply'] }).hasUnread).toBe(true);
  });
});
