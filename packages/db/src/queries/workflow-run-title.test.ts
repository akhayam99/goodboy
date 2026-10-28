import { describe, expect, it } from 'vitest';
import { stripTitlePreamble } from './title-preamble';
import { cleanWorkflowRunTitle } from './workflow-run-title';

const GOAL =
  'Move patient settings under /patient/settings with a centered layout\nDescription\nCloses ACME-1366';

describe('stripTitlePreamble', () => {
  it('drops a Title label, wrapping quotes and markdown marks', () => {
    expect(stripTitlePreamble({ text: 'Title: Batch the ledger reads' })).toBe(
      'Batch the ledger reads',
    );
    expect(stripTitlePreamble({ text: '**Title:** "Batch the ledger reads"' })).toBe(
      'Batch the ledger reads',
    );
    expect(stripTitlePreamble({ text: '## Titolo - Sistema il layout' })).toBe('Sistema il layout');
  });

  it('keeps a title that only starts with an issue number', () => {
    expect(stripTitlePreamble({ text: '#2053 release notes' })).toBe('#2053 release notes');
  });
});

describe('cleanWorkflowRunTitle', () => {
  it('keeps a clean title as it is', () => {
    expect(cleanWorkflowRunTitle({ title: 'Speed up the ledger export', goal: GOAL })).toBe(
      'Speed up the ledger export',
    );
  });

  it('is idempotent', () => {
    const once = cleanWorkflowRunTitle({ title: 'Title: "Fix the flaky sync"', goal: GOAL });
    expect(cleanWorkflowRunTitle({ title: once, goal: GOAL })).toBe(once);
  });

  it('strips the Title preamble and the quotes', () => {
    expect(cleanWorkflowRunTitle({ title: 'Title: "Fix the flaky sync".', goal: GOAL })).toBe(
      'Fix the flaky sync',
    );
  });

  it('falls back to the first line of the ask when the title is a leaked preamble', () => {
    expect(cleanWorkflowRunTitle({ title: 'Title: the user asked for a', goal: GOAL })).toBe(
      'Move patient settings under /patient/settings with a\u2026',
    );
  });

  it('never cuts the fallback in the middle of a word', () => {
    const goal = `${'ledger '.repeat(20)}end`;
    const title = cleanWorkflowRunTitle({ title: 'I will write a title', goal });
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('ledger…')).toBe(true);
  });

  it('never cuts a long clean title in the middle of a word', () => {
    const title = cleanWorkflowRunTitle({
      title: 'Reconcile settlements between payments-api and notify-relay ledgers',
      goal: GOAL,
    });
    expect(title).toBe('Reconcile settlements between payments-api and notify-relay');
  });

  it('treats a title that reads as a sentence as a leak', () => {
    expect(
      cleanWorkflowRunTitle({
        title: 'Here is a short title for the ledger export workflow you asked',
        goal: 'Speed up the ledger export',
      }),
    ).toBe('Speed up the ledger export');
  });

  it('returns an empty string when neither the title nor the ask has text', () => {
    expect(cleanWorkflowRunTitle({ title: 'Title:', goal: null })).toBe('');
  });
});
