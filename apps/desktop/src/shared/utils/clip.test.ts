import { describe, expect, it } from 'vitest';
import { clip } from './clip';

describe('clip', () => {
  it('trims and keeps a short text whole', () => {
    expect(clip({ text: '  Harborline  ', limit: 20 })).toBe('Harborline');
  });

  it('cuts a long text at the limit and adds an ellipsis', () => {
    expect(clip({ text: 'ledger-core payments-api', limit: 11 })).toBe('ledger-core...');
  });
});
