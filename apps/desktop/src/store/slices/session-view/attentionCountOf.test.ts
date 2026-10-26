// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStage, SessionStageInfo } from '@goodboy/types';
import { attentionCountOf } from './attentionCountOf';

type AttentionItem = Parameters<typeof attentionCountOf>[0]['items'][number];

type ItemParams = {
  readonly id: string;
  readonly attention: SessionAttentionReason | null;
  readonly others?: ReadonlyArray<SessionAttentionReason>;
  readonly stage?: SessionStage;
};

const itemOf = ({
  id,
  attention,
  others = [],
  stage = 'attention',
}: ItemParams): AttentionItem => ({
  id,
  info: {
    stage,
    reason: '',
    addsFact: true,
    attention,
    prState: null,
    otherReasons: others,
  },
});

const count = (...items: ReadonlyArray<AttentionItem>) => attentionCountOf({ items });

describe('attentionCountOf', () => {
  it('counts nothing for no session and for sessions that do not wait', () => {
    expect(count()).toMatchObject({ count: 0, quietCount: 0, tone: null });
    expect(count(itemOf({ id: 'a', attention: null, stage: 'building' }))).toMatchObject({
      count: 0,
      quietCount: 0,
      tone: null,
    });
  });

  it('counts every session that waits on a question, an approval or a run, in amber', () => {
    expect(
      count(
        itemOf({ id: 'a', attention: 'open-question' }),
        itemOf({ id: 'b', attention: 'run-waits-for-go' }),
        itemOf({ id: 'c', attention: 'plan-approval' }),
      ),
    ).toEqual({ count: 3, quietCount: 0, tone: 'warning', countedIds: ['a', 'b', 'c'] });
  });

  it('turns red as soon as one counted session is broken', () => {
    expect(
      count(
        itemOf({ id: 'a', attention: 'open-question' }),
        itemOf({ id: 'b', attention: 'agent-error' }),
      ).tone,
    ).toBe('danger');
    expect(count(itemOf({ id: 'a', attention: 'run-stopped' })).tone).toBe('danger');
    expect(count(itemOf({ id: 'a', attention: 'ci-failed' })).tone).toBe('danger');
  });

  it('reads the broken reason behind the winner as well', () => {
    expect(count(itemOf({ id: 'a', attention: 'open-question', others: ['ci-failed'] })).tone).toBe(
      'danger',
    );
  });

  it('keeps a reply to read and an approval to merge out of the count', () => {
    expect(
      count(
        itemOf({ id: 'a', attention: 'unread-reply' }),
        itemOf({ id: 'b', attention: 'pr-approved' }),
      ),
    ).toEqual({ count: 0, quietCount: 2, tone: null, countedIds: [] });
  });

  it('counts the loud ones and the quiet ones apart', () => {
    expect(
      count(
        itemOf({ id: 'a', attention: 'unread-reply' }),
        itemOf({ id: 'b', attention: 'needs-approval' }),
      ),
    ).toEqual({ count: 1, quietCount: 1, tone: 'warning', countedIds: ['b'] });
  });

  it('leaves out the merge queue, which sits in review', () => {
    expect(count(itemOf({ id: 'a', attention: 'pr-queued', stage: 'review' }))).toMatchObject({
      count: 0,
      quietCount: 0,
    });
  });

  it('names the sessions it counted, so a view can tell which ones it hides', () => {
    const result = count(
      itemOf({ id: 'a', attention: 'unread-reply' }),
      itemOf({ id: 'b', attention: 'slack-reply-waiting' }),
      itemOf({ id: 'c', attention: 'auto-needs-you' }),
    );

    expect(result.countedIds).toEqual(['b', 'c']);
  });

  it('describes a session by stage info alone', () => {
    const info: SessionStageInfo = {
      stage: 'attention',
      reason: 'x',
      addsFact: true,
      attention: 'run-paused-at-limit',
      prState: null,
    };

    expect(attentionCountOf({ items: [{ id: 'a', info }] }).count).toBe(1);
  });
});
