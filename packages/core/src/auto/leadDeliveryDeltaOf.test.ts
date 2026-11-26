import { describe, expect, it } from 'vitest';
import { deliverySentOf } from './deliverySentOf';
import { leadDeliveryDeltaOf } from './leadDeliveryDeltaOf';
import type { LeadDeliveryPart } from './leadDeliveryPart';

const LEDGER_V1 = [
  'Artifacts in this tree, as of 2026-11-26T10:00:00.000Z, generation 1.',
  '- art-plan (plan) "Ledger export" v1, ready, approval approved',
  '  made by planner agent-p in delegation-p; no history',
  '- art-notes (doc) "notify-relay notes" v1, ready, approval needs_approval',
  '  made by scout agent-s in delegation-s; no history',
].join('\n');

const LEDGER_V2 = [
  'Artifacts in this tree, as of 2026-11-26T10:05:00.000Z, generation 1.',
  '- art-plan (plan) "Ledger export" v2, ready, approval needs_approval',
  '  made by planner agent-p in delegation-p; last edit by planner',
  '- art-notes (doc) "notify-relay notes" v1, ready, approval needs_approval',
  '  made by scout agent-s in delegation-s; no history',
].join('\n');

type PartsParams = {
  readonly ledger: string;
  readonly budget: string;
  readonly user: string;
};

const partsOf = ({ ledger, budget, user }: PartsParams): ReadonlyArray<LeadDeliveryPart> => [
  { name: 'markers', kind: 'state', text: 'context handoff protocol' },
  { name: 'ledger', kind: 'list', text: ledger },
  { name: 'budget', kind: 'state', text: budget },
  { name: 'user', kind: 'news', text: user },
];

describe('the changes a Lead delivery carries', () => {
  const first = partsOf({ ledger: LEDGER_V1, budget: 'Spent 0.40 USD.', user: 'first' });
  const sent = deliverySentOf({ parts: first });

  it('keeps the new message and drops every part the session already has', () => {
    const next = partsOf({ ledger: LEDGER_V1, budget: 'Spent 0.40 USD.', user: 'second' });

    expect(leadDeliveryDeltaOf({ parts: next, sent })).toBe('second');
  });

  it('sends a changed line under its heading and leaves out the lines that stayed', () => {
    const next = partsOf({ ledger: LEDGER_V2, budget: 'Spent 0.90 USD.', user: 'second' });

    const text = leadDeliveryDeltaOf({ parts: next, sent });

    expect(text).toContain('as of 2026-11-26T10:05:00.000Z');
    expect(text).toContain('"Ledger export" v2');
    expect(text).not.toContain('notify-relay notes');
    expect(text).toContain('Spent 0.90 USD.');
    expect(text).not.toContain('context handoff protocol');
  });

  it('sends the whole list again when a line left it', () => {
    const shorter = LEDGER_V1.split('\n').slice(0, 3).join('\n');
    const next = partsOf({ ledger: shorter, budget: 'Spent 0.40 USD.', user: '' });

    expect(leadDeliveryDeltaOf({ parts: next, sent })).toBe(shorter);
  });

  it('sends a part the session never got, whole', () => {
    const next: ReadonlyArray<LeadDeliveryPart> = [
      ...first,
      { name: 'mounts', kind: 'state', text: 'MOUNTS: mount-ledger-core.' },
    ];

    expect(leadDeliveryDeltaOf({ parts: next, sent })).toBe('first\n\nMOUNTS: mount-ledger-core.');
  });
});
