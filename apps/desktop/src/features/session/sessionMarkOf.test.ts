import { describe, expect, it } from 'vitest';
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
