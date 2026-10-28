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

  it.each([
    ['#### Batch the reads  ', 'Batch the reads'],
    ['####### Batch the reads', '####### Batch the reads'],
    ['> - **Batch the reads**', 'Batch the reads'],
    ['__Batch the reads__', 'Batch the reads'],
    ['`Batch the reads`', 'Batch the reads'],
    ['~~Batch the reads~~', 'Batch the reads'],
    ['\u201cBatch the reads\u201d', 'Batch the reads'],
    ['*** x ***', 'x *'],
    ['Name - Batch the reads', 'Batch the reads'],
    ['', ''],
    ['  \t\n ', ''],
  ])('reads %j as %j', (text, expected) => {
    expect(stripTitlePreamble({ text })).toBe(expected);
  });

  describe('on a long run of one repeated character', () => {
    const LENGTH = 60_000;
    const MAX_MS = 750;

    const timed = (run: () => string): { readonly out: string; readonly ms: number } => {
      const startedAt = performance.now();
      const out = run();
      return { out, ms: performance.now() - startedAt };
    };

    it.each([
      ['tabs', '\t'],
      ['spaces', ' '],
      ['asterisks', '**'],
      ['underscores', '__'],
      ['backticks', '`'],
      ['tildes', '~~'],
      ['quotes', '"'],
    ])('stays linear on %s inside the text', (_name, unit) => {
      const text = `x${unit.repeat(LENGTH)}x`;

      const { out, ms } = timed(() => stripTitlePreamble({ text }));

      expect(ms).toBeLessThan(MAX_MS);
      expect(out.startsWith('x')).toBe(true);
      expect(out.endsWith('x')).toBe(true);
    });

    it('stays linear on trailing punctuation inside the title', () => {
      const title = `x${'!'.repeat(LENGTH)}x`;

      const { out, ms } = timed(() => cleanWorkflowRunTitle({ title, goal: GOAL }));

      expect(ms).toBeLessThan(MAX_MS);
      expect(out.length).toBeLessThanOrEqual(60);
    });

    it('stays linear on a long run of hashes', () => {
      const text = `${'#'.repeat(LENGTH)} x`;

      const { ms } = timed(() => stripTitlePreamble({ text }));

      expect(ms).toBeLessThan(MAX_MS);
    });
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
