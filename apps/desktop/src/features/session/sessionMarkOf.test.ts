import { describe, expect, it } from 'vitest';
import type { StatusMarkSpec } from '@goodboy/ui';
import type { SessionAttentionReason } from '@goodboy/types';
import { sessionMarkOf } from './sessionMarkOf';
import { sessionNodeOf } from './sessionNode';

type Info = Parameters<typeof sessionNodeOf>[0]['info'];

const BASE: Info = {
  stage: 'building',
  attention: null,
  isRunning: false,
  otherReasons: [],
  openQuestionCount: 0,
  fixNeedsYouCount: 0,
  fixCouldntFixCount: 0,
  noteNeedsYouCount: 0,
  noteCouldntFixCount: 0,
};

type MarkParams = {
  readonly info: Partial<Info>;
  readonly isArchived?: boolean;
};

const markOf = ({ info, isArchived = false }: MarkParams) =>
  sessionMarkOf({ node: sessionNodeOf({ info: { ...BASE, ...info }, isArchived }) });

describe('sessionMarkOf', () => {
  it.each<[SessionAttentionReason, StatusMarkSpec]>([
    ['agent-error', { kind: 'state', state: 'failed' }],
    ['push-failed', { kind: 'state', state: 'failed' }],
    ['ci-failed', { kind: 'state', state: 'failed' }],
    ['run-stopped', { kind: 'state', state: 'failed' }],
    ['open-question', { kind: 'state', state: 'question' }],
    ['fix-needs-you', { kind: 'state', state: 'question' }],
    ['needs-approval', { kind: 'state', state: 'approval' }],
    ['plan-approval', { kind: 'state', state: 'approval' }],
    ['run-waits-for-go', { kind: 'state', state: 'approval' }],
    ['auto-needs-you', { kind: 'state', state: 'approval' }],
    ['slack-reply-waiting', { kind: 'state', state: 'approval' }],
    ['changes-requested', { kind: 'state', state: 'alert' }],
    ['fix-couldnt-fix', { kind: 'state', state: 'alert' }],
    ['run-paused-at-limit', { kind: 'state', state: 'alert' }],
    ['pr-queued', { kind: 'state', state: 'merging' }],
    ['pr-approved', { kind: 'state', state: 'approved' }],
    ['unread-reply', { kind: 'dot', tone: 'unread' }],
  ])('draws %s as %o', (attention, mark) => {
    expect(markOf({ info: { stage: 'attention', attention } })).toEqual(mark);
  });

  it('keeps a bare needs you stage on the question glyph', () => {
    expect(markOf({ info: { stage: 'attention' } })).toEqual({ kind: 'state', state: 'question' });
  });

  it('draws the merge queue as the moving ring', () => {
    expect(markOf({ info: { stage: 'review', attention: 'pr-queued' } })).toEqual({
      kind: 'state',
      state: 'merging',
    });
  });

  it('draws a question as one bare glyph, never inside a ring', () => {
    expect(markOf({ info: { stage: 'attention', attention: 'open-question' } })).toEqual({
      kind: 'state',
      state: 'question',
    });
  });

  it('draws an approval as one bare glyph', () => {
    expect(markOf({ info: { stage: 'attention', attention: 'needs-approval' } })).toEqual({
      kind: 'state',
      state: 'approval',
    });
  });

  it('keeps the ask over a running session', () => {
    expect(
      markOf({ info: { stage: 'attention', attention: 'open-question', isRunning: true } }),
    ).toEqual({ kind: 'state', state: 'question' });
  });

  it('turns the ring for a running session', () => {
    expect(markOf({ info: { stage: 'running' } })).toEqual({ kind: 'state', state: 'running' });
  });

  it('draws the unread dot alone on a calm session', () => {
    expect(markOf({ info: { stage: 'building', otherReasons: ['unread-reply'] } })).toEqual({
      kind: 'dot',
      tone: 'unread',
    });
    expect(markOf({ info: { stage: 'done', otherReasons: ['unread-reply'] } })).toEqual({
      kind: 'dot',
      tone: 'unread',
    });
  });

  it('draws a merged check for done and a slash for a closed pull request', () => {
    expect(markOf({ info: { stage: 'done' } })).toEqual({ kind: 'state', state: 'merged' });
    expect(markOf({ info: { stage: 'done', prState: 'closed' } })).toEqual({
      kind: 'state',
      state: 'closed',
    });
  });

  it('leaves the slot empty for an idle or archived session', () => {
    expect(markOf({ info: { stage: 'review' } })).toEqual({ kind: 'empty' });
    expect(markOf({ info: { stage: 'done' }, isArchived: true })).toEqual({ kind: 'empty' });
  });
});
