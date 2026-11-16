// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shortPathOf } from './shortPathOf';

describe('shortPathOf', () => {
  it('shortens a long path in the middle and keeps its head and file', () => {
    expect(
      shortPathOf({ value: 'apps/payments-api/src/webhooks/deliveries/handleDelivery.ts' }),
    ).toBe('apps/…/deliveries/handleDelivery.ts');
    expect(
      shortPathOf({
        value: 'apps/console/src/features/deliveries/hooks/useDeliveryRetriesForTenants/index.ts',
      }),
    ).toBe('apps/…/index.ts');
  });

  it('keeps a root path rooted', () => {
    expect(shortPathOf({ value: '/internal/deliveries/stuck/attempts/latest/summary' })).toBe(
      '/internal/…/latest/summary',
    );
  });

  it('leaves short values, commands and identifiers whole', () => {
    expect(shortPathOf({ value: '/v2/deliveries/:id/attempts' })).toBe(
      '/v2/deliveries/:id/attempts',
    );
    expect(shortPathOf({ value: 'GET /internal/deliveries/stuck/attempts/latest' })).toBe(
      'GET /internal/deliveries/stuck/attempts/latest',
    );
    expect(shortPathOf({ value: 'useDeliveryRetriesForEveryTenantAndRegion' })).toBe(
      'useDeliveryRetriesForEveryTenantAndRegion',
    );
  });
});
