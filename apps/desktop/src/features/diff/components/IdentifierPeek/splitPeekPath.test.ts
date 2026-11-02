import { describe, expect, it } from 'vitest';
import { splitPeekPath } from './splitPeekPath';

describe('splitPeekPath', () => {
  it('drops leading segments and keeps the ones next to the file whole', () => {
    expect(
      splitPeekPath({ path: 'apps/payments-api/src/ledger-core/components/notify-relay.tsx' }),
    ).toEqual({
      directory: '…/src/ledger-core/components',
      separator: '/',
      name: 'notify-relay.tsx',
      isCut: true,
    });
  });

  it('never cuts inside a segment, so the shown path is always a real tail of the path', () => {
    const path = 'apps/payments-api/src/ledger-core/components/notify-relay.tsx';
    const { directory } = splitPeekPath({ path });
    expect(path).toContain(directory.replace('…/', ''));
    expect(path.split('/')).toEqual(expect.arrayContaining(directory.replace('…/', '').split('/')));
  });

  it('keeps the nearest directory whole even when it alone exceeds the limit', () => {
    expect(
      splitPeekPath({ path: 'apps/ledger-core-settlement-rounding-fixtures/notify-relay.ts' }),
    ).toEqual({
      directory: '…/ledger-core-settlement-rounding-fixtures',
      separator: '/',
      name: 'notify-relay.ts',
      isCut: true,
    });
  });

  it('keeps a short directory and a root filename readable', () => {
    expect(splitPeekPath({ path: 'src/ledger-core.ts' })).toEqual({
      directory: 'src',
      separator: '/',
      name: 'ledger-core.ts',
      isCut: false,
    });
    expect(splitPeekPath({ path: 'ledger-core.ts' })).toEqual({
      directory: '',
      separator: '',
      name: 'ledger-core.ts',
      isCut: false,
    });
  });
});
