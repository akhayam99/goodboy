import { describe, expect, it } from 'vitest';
import type { ResolverStatus } from '../../resolver-linkage';
import { resolverBadgeState, resolverStateSentence } from './index';

const ALL_STATUSES: ReadonlyArray<ResolverStatus> = [
  'pending',
  'running',
  'failed',
  'resolved',
  'committed',
  'analyzed',
  'wontfix',
  'awaiting',
  'stopped',
  'done',
];

describe('resolverBadgeState', () => {
  it('maps every resolver status to a badge state', () => {
    const states = ALL_STATUSES.map((status) => resolverBadgeState(status));
    expect(states).toEqual([
      'queued',
      'working',
      'failed',
      'resolved',
      'needsYou',
      'needsYou',
      'needsYou',
      'needsYou',
      'needsYou',
      'needsYou',
    ]);
  });
});

describe('resolverStateSentence', () => {
  it('maps every resolver status to its sentence or null', () => {
    const sentences = ALL_STATUSES.map((status) => resolverStateSentence(status));
    expect(sentences).toEqual([
      null,
      null,
      null,
      null,
      'fix committed, ready to push',
      'verdict ready',
      'recommends closing without a change',
      'asked you a question',
      'stopped before a verdict',
      'finished without a verdict',
    ]);
  });
});
