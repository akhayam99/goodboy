import { describe, expect, it } from 'vitest';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveFailedStep, ResolveUiState } from './resolveRowState';
import { conversationAgentResult, hasConversationAgent } from './conversationAgentResult';

const row = ({
  status,
  integratedSha = null,
  commitShas = null,
  proposalKind = 'fix',
  failedStep = null,
  hasAttempt = true,
  fixupOfSha = null,
  replacesSha = null,
}: {
  readonly status: ResolveUiState;
  readonly integratedSha?: string | null;
  readonly commitShas?: ReadonlyArray<string> | null;
  readonly fixupOfSha?: string | null;
  readonly replacesSha?: string | null;
  readonly proposalKind?: ResolveQueueRow['proposalKind'];
  readonly failedStep?: ResolveFailedStep | null;
  readonly hasAttempt?: boolean;
}): ResolveQueueRow =>
  ({
    status,
    proposalKind,
    rowState: { failedStep },
    item: { integratedSha },
    thread: { commitShas, fixupOfSha, replacesSha, question: 'Counter or histogram?' },
    attempt: hasAttempt ? { id: 'attempt' } : null,
  }) as unknown as ResolveQueueRow;

describe('conversationAgentResult', () => {
  it('shows the one sha that lands on the branch, integrated first', () => {
    expect(
      conversationAgentResult({
        row: row({ status: 'ready', integratedSha: '9e8d7c6', commitShas: ['4f21c8b'] }),
      }),
    ).toMatchObject({ lead: 'Fixed in', sha: '9e8d7c6', isPushed: false });
    expect(
      conversationAgentResult({ row: row({ status: 'resolved', commitShas: ['4f21c8b'] }) }),
    ).toMatchObject({ sha: '4f21c8b', isPushed: true });
  });

  it('names the commit a fix is a fixup of, or the one it replaced', () => {
    expect(
      conversationAgentResult({
        row: row({ status: 'ready', commitShas: ['9e8d7c6'], fixupOfSha: '3a1f9c2' }),
      }).link,
    ).toEqual({ label: 'fixup of', sha: '3a1f9c2' });
    expect(
      conversationAgentResult({
        row: row({ status: 'ready', commitShas: ['7c1e0aa'], replacesSha: '4f21c8b' }),
      }).link,
    ).toEqual({ label: 'replaces', sha: '4f21c8b' });
    expect(
      conversationAgentResult({ row: row({ status: 'ready', commitShas: ['4f21c8b'] }) }).link,
    ).toBeUndefined();
  });

  it('says reply only or no change when there is no commit', () => {
    expect(
      conversationAgentResult({ row: row({ status: 'ready', proposalKind: 'reply_only' }) }).lead,
    ).toBe('Reply only');
    expect(
      conversationAgentResult({ row: row({ status: 'ready', proposalKind: 'none' }) }).lead,
    ).toBe('No change');
  });

  it('carries the question and the failed run on the child row', () => {
    expect(conversationAgentResult({ row: row({ status: 'needs_you' }) })).toMatchObject({
      node: 'question',
      lead: 'Counter or histogram?',
    });
    expect(
      conversationAgentResult({ row: row({ status: 'failed', failedStep: 'run' }) }).node,
    ).toBe('failed');
  });

  it('hides the child row when no agent ever worked on the comment', () => {
    expect(hasConversationAgent({ row: row({ status: 'new', hasAttempt: false }) })).toBe(false);
    expect(
      hasConversationAgent({ row: row({ status: 'ready', hasAttempt: false, commitShas: ['a'] }) }),
    ).toBe(true);
  });
});
