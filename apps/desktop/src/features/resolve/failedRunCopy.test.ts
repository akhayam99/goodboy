import { describe, expect, it } from 'vitest';
import { failedVerbOf, tryAgainLabel } from './failedRunCopy';
import type { ResolveRowAction } from './resolveRowState';

describe('failedRunCopy', () => {
  it('gives every row action a visible verb', () => {
    const actions: ReadonlyArray<ResolveRowAction> = [
      'resolve',
      'answer',
      'review',
      'retry',
      'retry_reply',
      'open_github',
      'resume',
    ];
    for (const action of actions) {
      expect(failedVerbOf({ step: 'run', action }).trim()).not.toBe('');
    }
  });

  it('names the push when the failed step is the push', () => {
    expect(failedVerbOf({ step: 'push', action: 'retry' })).toBe('Push again');
    expect(failedVerbOf({ step: 'run', action: 'retry' })).toBe('Retry');
    expect(failedVerbOf({ step: 'uncertain', action: 'open_github' })).toBe('Open on GitHub');
  });

  it('follows the picked model and the hint in the primary label', () => {
    expect(tryAgainLabel({ modelName: null, hasHint: false })).toBe('Retry');
    expect(tryAgainLabel({ modelName: 'Opus 5', hasHint: false })).toBe('Retry on Opus 5');
    expect(tryAgainLabel({ modelName: 'Opus 5', hasHint: true })).toBe('Retry with the hint');
  });
});
