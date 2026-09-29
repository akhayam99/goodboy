// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { summaryItems } from './summaryItems';

describe('summaryItems', () => {
  it('splits bullet groups into one item per bullet, keeping sub-bullets with their parent', () => {
    const body = [
      '- Dedupe check is live in payments-api',
      '  - behind the idempotency column',
      '- Backfill is written',
      '',
      '- web-console shows nothing yet',
    ].join('\n');

    expect(summaryItems({ body })).toEqual([
      'Dedupe check is live in payments-api\n- behind the idempotency column',
      'Backfill is written',
      'web-console shows nothing yet',
    ]);
  });

  it('splits prose into sentences so the first one can lead', () => {
    const body =
      'The dedupe check is live in payments-api. The backfill stays read only.\nweb-console shows nothing.';

    expect(summaryItems({ body })).toEqual([
      'The dedupe check is live in payments-api.',
      'The backfill stays read only. web-console shows nothing.',
    ]);
  });

  it('returns nothing for an empty body', () => {
    expect(summaryItems({ body: '  \n\n' })).toEqual([]);
  });
});
