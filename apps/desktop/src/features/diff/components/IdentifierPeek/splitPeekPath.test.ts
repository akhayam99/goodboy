import { describe, expect, it } from 'vitest';
import { splitPeekPath } from './splitPeekPath';

describe('splitPeekPath', () => {
  it('middle-truncates the directory and keeps its separator before the intact filename', () => {
    expect(
      splitPeekPath({ path: 'apps/payments-api/src/ledger-core/components/notify-relay.tsx' }),
    ).toEqual({
      directory: 'apps/payments-…ore/components',
      separator: '/',
      name: 'notify-relay.tsx',
    });
  });

  it('keeps a short directory and a root filename readable', () => {
    expect(splitPeekPath({ path: 'src/ledger-core.ts' })).toEqual({
      directory: 'src',
      separator: '/',
      name: 'ledger-core.ts',
    });
    expect(splitPeekPath({ path: 'ledger-core.ts' })).toEqual({
      directory: '',
      separator: '',
      name: 'ledger-core.ts',
    });
  });
});
