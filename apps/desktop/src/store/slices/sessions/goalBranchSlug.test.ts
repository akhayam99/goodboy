// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { goalBranchSlug } from './goalBranchSlug';

const MAX = 40;

const CASES: ReadonlyArray<readonly [string, string]> = [
  [
    'Devo fare la first time user experience per i pazienti senza percorso attivo',
    'first-time-user-experience-pazienti',
  ],
  [
    'First-time user experience (FTUE) for patients with no active care path',
    'first-time-user-experience-ftue',
  ],
  [
    'I need to fix the duplicate credit on payments-api please',
    'fix-duplicate-credit-payments-api',
  ],
  ['HBL-1528 remove the slot from the booking page', 'hbl-1528-remove-slot-booking-page'],
  ['Please remove the slot HBL-1528', 'hbl-1528-remove-slot'],
  [
    'Vorrei aggiungere il widget di benvenuto nella home per i nuovi utenti',
    'aggiungere-widget-benvenuto-home-nuovi',
  ],
  ['Add FTUE onboarding to Harborline', 'add-ftue-onboarding-harborline'],
  ['Perché il riepilogo è più lento?', 'riepilogo-lento'],
  ["Voglio che l'utente veda il saldo di ledger-core", 'utente-veda-saldo-ledger-core'],
  [
    'Investigate reconciliation backfill throughput regression across ledger-core shards',
    'investigate-reconciliation-backfill',
  ],
  [
    'Can you please make the Northwind retry budget configurable',
    'northwind-retry-budget-configurable',
  ],
  ['the a to', ''],
  ['', ''],
];

describe('goalBranchSlug', () => {
  it.each(CASES)('names %j as %j', (text, slug) => {
    expect(goalBranchSlug({ text, maxLength: MAX })).toBe(slug);
  });

  it('never goes past the limit and never ends on half a word', () => {
    for (const [text] of CASES) {
      const slug = goalBranchSlug({ text, maxLength: MAX });
      expect(slug.length).toBeLessThanOrEqual(MAX);
      expect(slug.endsWith('-')).toBe(false);
    }
  });

  it('keeps at most five words', () => {
    const slug = goalBranchSlug({
      text: 'add ledger retry budget alerts notify relay',
      maxLength: 80,
    });
    expect(slug).toBe('add-ledger-retry-budget-alerts');
  });

  it('cuts a single word longer than the limit', () => {
    const slug = goalBranchSlug({ text: 'x'.repeat(60), maxLength: MAX });
    expect(slug).toHaveLength(MAX);
  });
});
