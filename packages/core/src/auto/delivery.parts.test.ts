import { describe, expect, it } from 'vitest';
import { buildDeliveryParts, buildDeliveryText } from './delivery';
import { deliverySentOf } from './deliverySentOf';
import { leadDeliveryDeltaOf } from './leadDeliveryDeltaOf';
import { EMPTY_USER_FACTS } from './outboxPayload';

const input = {
  ledgerBlock: 'Artifacts in this tree, as of 2026-11-26T10:00:00.000Z.\nNone yet.',
  budgetLine: 'Budget for this conversation: 5.00 USD. Spent 0.40 USD.',
  mountsLine: 'MOUNTS: mount-ledger (ledger-core, branch ak/ledger).',
  digestBlock: 'STATE OF THIS CONVERSATION\nNo agent is open.',
  artifactsBlock: '',
  rows: [{ id: 'outbox-1', payload: { kind: 'user', text: 'add tests', facts: EMPTY_USER_FACTS } }],
  childLabels: new Map<string, string>(),
  isRestart: false,
};

describe('the parts of a delivery', () => {
  it('join into the very text a full delivery carries', () => {
    expect(buildDeliveryText(input)).toBe(
      buildDeliveryParts(input)
        .map((part) => part.text)
        .filter((text) => text !== '')
        .join('\n\n'),
    );
  });

  it('keep only the new message when the tree did not change since the last delivery', () => {
    const sent = deliverySentOf({ parts: buildDeliveryParts(input) });
    const next = buildDeliveryParts({
      ...input,
      ledgerBlock: 'Artifacts in this tree, as of 2026-11-26T10:03:00.000Z.\nNone yet.',
      rows: [
        { id: 'outbox-2', payload: { kind: 'user', text: 'and docs', facts: EMPTY_USER_FACTS } },
      ],
    });

    const text = leadDeliveryDeltaOf({ parts: next, sent });

    expect(text).toContain('and docs');
    expect(text).not.toContain('Artifacts in this tree');
    expect(text).not.toContain('MOUNTS:');
    expect(text).not.toContain('STATE OF THIS CONVERSATION');
  });

  it('carry the budget line again once the spend moved', () => {
    const sent = deliverySentOf({ parts: buildDeliveryParts(input) });
    const next = buildDeliveryParts({
      ...input,
      budgetLine: 'Budget for this conversation: 5.00 USD. Spent 0.95 USD.',
    });

    expect(leadDeliveryDeltaOf({ parts: next, sent })).toContain('Spent 0.95 USD.');
  });
});
