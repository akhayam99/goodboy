// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_WORKFLOW_TITLE_LENGTH, clampWorkflowTitle } from './titleLimit';

describe('clampWorkflowTitle', () => {
  it('keeps a short title and trims it', () => {
    expect(clampWorkflowTitle('  Reconcile the ledger  ')).toBe('Reconcile the ledger');
  });

  it('cuts a long title at a word boundary, never inside a word', () => {
    const title = clampWorkflowTitle(
      'Reconcile settlements between payments-api and notify-relay ledgers',
    );

    expect(title).toBe('Reconcile settlements between payments-api and notify-relay');
    expect(title.length).toBeLessThanOrEqual(MAX_WORKFLOW_TITLE_LENGTH);
  });

  it('cuts a single unbroken word at the limit', () => {
    expect(clampWorkflowTitle('x'.repeat(80))).toHaveLength(MAX_WORKFLOW_TITLE_LENGTH);
  });
});
