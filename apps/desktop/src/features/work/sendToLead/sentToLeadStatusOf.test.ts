import { describe, expect, it } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import type { SentToLead } from '../../../store/slices/send-to-lead/state';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  FIXTURE_TREE,
  aView,
} from '../../auto/testing/autoViewFixtures';
import { sentToLeadStatusOf } from './sentToLeadStatusOf';

const ENTRY: SentToLead = {
  key: 'move:fix-checks',
  sessionId: FIXTURE_SESSION,
  target: {
    treeId: FIXTURE_TREE,
    rootAgentId: FIXTURE_ROOT,
    sessionId: FIXTURE_SESSION,
    title: 'HBL-417',
  },
  isNew: false,
  isCancelled: false,
  messageId: 'message-79',
  text: 'The check integration-tests failed.',
  note: '',
  threadId: null,
  mountId: null,
  branch: 'hl/ledger-batch',
  phase: 'sent',
  failure: null,
};

type ViewParams = {
  readonly phase: AutoPhase;
  readonly turnsUsed: number;
};

const viewOf = ({ phase, turnsUsed }: ViewParams) => {
  const base = aView({ phase });
  return { ...base, tree: { ...base.tree, turnsUsed } };
};

describe('sentToLeadStatusOf', () => {
  it('shows why Undo failed and keeps the delivery state underneath', () => {
    const status = sentToLeadStatusOf({
      entry: { ...ENTRY, failure: 'The Lead already read it.' },
      queue: [],
      views: [],
    });

    expect(status).toEqual({ kind: 'undoFailed', failure: 'The Lead already read it.' });
  });

  it('says a new Lead stopped before its first turn instead of Starting forever', () => {
    const entry = { ...ENTRY, isNew: true };

    expect(
      sentToLeadStatusOf({ entry, queue: [], views: [viewOf({ phase: 'stopped', turnsUsed: 0 })] })
        .kind,
    ).toBe('stopped');
    expect(
      sentToLeadStatusOf({
        entry,
        queue: [],
        views: [viewOf({ phase: 'answering', turnsUsed: 0 })],
      }).kind,
    ).toBe('starting');
    expect(
      sentToLeadStatusOf({ entry, queue: [], views: [viewOf({ phase: 'stopped', turnsUsed: 2 })] })
        .kind,
    ).toBe('onIt');
  });

  it('follows the outbox row of its own message, not another one with the same text', () => {
    const base = aView();
    const other = {
      rowId: '40',
      createdAt: 1,
      text: ENTRY.text,
      images: [],
      joinKey: 'user:queue:message-other',
    };
    const views = [{ ...base, pendingMessages: [other] }];

    expect(sentToLeadStatusOf({ entry: ENTRY, queue: [], views }).kind).toBe('onIt');
    expect(
      sentToLeadStatusOf({
        entry: ENTRY,
        queue: [],
        views: [
          {
            ...base,
            pendingMessages: [
              other,
              { ...other, rowId: '41', joinKey: `user:queue:${ENTRY.messageId}` },
            ],
          },
        ],
      }).kind,
    ).toBe('notRead');
  });
});
