import { describe, expect, it } from 'vitest';
import { resolverThreadFollowUpPrompt } from './resolverThreadFollowUpPrompt';

const THREAD_ID = 'PRRT_1';
const SHA = 'abcdef1234567890';

describe('resolverThreadFollowUpPrompt', () => {
  it.each([
    ['fix', 'Implement the change that thread asks for and commit it.'],
    ['redo', 'Redo it and commit again.'],
  ] as const)('keeps the %s wording when no prior commit exists', (intent, wording) => {
    const prompt = resolverThreadFollowUpPrompt({ threadId: THREAD_ID, intent, notes: '' });

    expect(prompt).toContain(wording);
    expect(prompt).not.toContain('git commit --amend --no-edit');
  });

  it.each(['fix', 'redo'] as const)(
    'tells a %s follow-up when to amend the prior commit',
    (intent) => {
      const prompt = resolverThreadFollowUpPrompt({
        threadId: THREAD_ID,
        intent,
        notes: '',
        priorCommitSha: SHA,
      });

      expect(prompt).toContain(`already resolved this thread with commit ${SHA}`);
      expect(prompt).toContain(`git branch -r --contains ${SHA}`);
      expect(prompt).toContain('git commit --amend --no-edit');
      expect(prompt).toContain('Never rebase or force-push.');
    },
  );
});
