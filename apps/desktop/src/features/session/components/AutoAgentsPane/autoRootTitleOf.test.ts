import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { autoRootTitleOf } from './autoRootTitleOf';

const BRIEF: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: brandId<ProviderRunId>({ value: 'mock-run-1' }),
    text: 'Write the Northwind release notes',
    at: brandId<IsoDateTime>({ value: '2026-10-20T10:00:00.000Z' }),
  },
];

describe('autoRootTitleOf', () => {
  it('reads the first line of the ask the tree view carries', () => {
    expect(
      autoRootTitleOf({
        name: 'Auto',
        ask: '\n  Fix the ledger-core retry\nwith tests',
        events: [],
      }),
    ).toBe('Fix the ledger-core retry');
  });

  it('falls back to the transcript brief, then to Auto', () => {
    expect(autoRootTitleOf({ name: 'Auto', ask: null, events: BRIEF })).toBe(
      'Write the Northwind release notes',
    );
    expect(autoRootTitleOf({ name: 'Auto', ask: '   ', events: BRIEF })).toBe(
      'Write the Northwind release notes',
    );
    expect(autoRootTitleOf({ name: 'Auto', ask: null, events: [] })).toBe('Auto');
  });

  it('keeps a name the owner gave', () => {
    expect(autoRootTitleOf({ name: 'Cascadia sweep', ask: 'Fix it', events: [] })).toBe(
      'Cascadia sweep',
    );
  });
});
