import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { SentToLead } from '../../../../store/slices/send-to-lead/state';
import { sentViewOf } from './sentViewOf';

const SESSION = brandId<SessionId>({ value: 'session-hbl-417' });

const ENTRY: SentToLead = {
  key: 'move:fix-checks',
  sessionId: SESSION,
  target: { treeId: null, rootAgentId: null, sessionId: SESSION, title: 'HBL-417' },
  isNew: true,
  isCancelled: false,
  messageId: 'message-79',
  text: 'The check integration-tests failed.',
  note: '',
  threadId: null,
  mountId: null,
  branch: 'hl/ledger-batch',
  phase: 'sending',
  failure: null,
};

describe('sentViewOf', () => {
  it('shows the Starting row with Undo while a new Lead starts', () => {
    expect(sentViewOf({ entry: ENTRY })).toBe('quiet');
    expect(sentViewOf({ entry: { ...ENTRY, isNew: false } })).toBe('none');
  });

  it('keeps the failure line with Retry under the Move, in the row layout too', () => {
    expect(sentViewOf({ entry: { ...ENTRY, phase: 'failed', failure: 'disk full' } })).toBe('line');
  });

  it('turns the Move into the quiet row once sent or stopped', () => {
    expect(sentViewOf({ entry: { ...ENTRY, phase: 'sent' } })).toBe('quiet');
    expect(sentViewOf({ entry: { ...ENTRY, phase: 'stopped' } })).toBe('quiet');
    expect(sentViewOf({ entry: undefined })).toBe('none');
  });
});
