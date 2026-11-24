import { describe, expect, it } from 'vitest';
import { cardFactsOf } from './cardFactsOf';

const NONE = { kind: 'none' } as const;

describe('cardFactsOf', () => {
  it('says the state and when the session last moved', () => {
    expect(
      cardFactsOf({
        reason: 'draft #318',
        hasFact: true,
        age: '2h ago',
        signal: NONE,
        isArchived: false,
      }),
    ).toEqual({ state: 'Draft #318', age: '2h ago' });
  });

  it('keeps only the time when the state is the stage default', () => {
    expect(
      cardFactsOf({
        reason: 'no PR yet',
        hasFact: false,
        age: '5m ago',
        signal: NONE,
        isArchived: false,
      }),
    ).toEqual({ state: '', age: '5m ago' });
  });

  it('leaves the state to the signal when it already says why the session waits', () => {
    expect(
      cardFactsOf({
        reason: 'approved, ready to merge',
        hasFact: true,
        age: '1h ago',
        signal: {
          kind: 'attention',
          reason: 'pr-approved',
          label: 'Approved, ready to merge',
          word: 'Approved, ready to merge',
        },
        isArchived: false,
      }),
    ).toEqual({ state: '', age: '1h ago' });
  });

  it('says only the time on an archived card', () => {
    expect(
      cardFactsOf({
        reason: '#90 merged',
        hasFact: true,
        age: '3d ago',
        signal: NONE,
        isArchived: true,
      }),
    ).toEqual({ state: '', age: '3d ago' });
  });

  it('draws nothing when it knows nothing', () => {
    expect(
      cardFactsOf({ reason: ' ', hasFact: true, age: '', signal: NONE, isArchived: false }),
    ).toEqual({ state: '', age: '' });
  });
});
