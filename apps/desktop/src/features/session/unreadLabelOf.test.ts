// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { unreadLabelOf } from './unreadLabelOf';

const agentOf = (summary: string) =>
  anAgent({ id: brandId<AgentId>({ value: 'audit' }), name: 'Audit', outputSummary: summary });

describe('unreadLabelOf plain text', () => {
  it('strips bold markers from the summary of what is new', () => {
    const unread = [
      agentOf('Audit in sola lettura: verdetto complessivo **da correggere**.'),
      agentOf('Second.'),
    ];

    expect(unreadLabelOf({ unread })).toBe(
      '2 new: Audit in sola lettura: verdetto complessivo da correggere, and 1 more',
    );
  });

  it('drops an unclosed bold marker instead of showing it', () => {
    const unread = [agentOf('Verdetto complessivo **da correggere')];

    expect(unreadLabelOf({ unread })).toBe('1 new: Verdetto complessivo da correggere');
  });

  it('keeps the words of code and links without their syntax', () => {
    const unread = [agentOf('Fixed `ledger-core` per [the note](https://example.com).')];

    expect(unreadLabelOf({ unread })).toBe('1 new: Fixed ledger-core per the note');
  });

  it('falls back to the agent name when the summary is only markers', () => {
    const unread = [agentOf('****')];

    expect(unreadLabelOf({ unread })).toBe('1 new: Audit');
  });
});
