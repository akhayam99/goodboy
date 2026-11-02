import { describe, expect, it } from 'vitest';
import { oneLine } from './oneLine';

describe('oneLine', () => {
  it('collapses whitespace into one line', () => {
    expect(oneLine({ text: 'fix  ledger-core\n  retry ' })).toBe('fix ledger-core retry');
  });

  it('cuts at max with an ellipsis when max is given', () => {
    expect(oneLine({ text: 'payments-api outage', max: 8 })).toBe('payments...');
  });
});
