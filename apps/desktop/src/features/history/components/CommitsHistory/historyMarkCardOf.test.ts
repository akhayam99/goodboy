import { describe, expect, it } from 'vitest';
import { conflictCardOf } from './conflictCardOf';
import { historyMarkCardOf } from './historyMarkCardOf';

describe('historyMarkCardOf', () => {
  it('lists every taken commit as its own row', () => {
    const card = historyMarkCardOf({
      label: 'Combines 2 commits',
      facts: [
        { label: 'Commit 1', value: 'Add ledger export' },
        { label: 'Commit 2', value: 'Fix export header' },
      ],
    });

    expect(card.title).toBe('Combines 2 commits');
    expect(card.facts.map((fact) => fact.value)).toEqual([
      'Add ledger export',
      'Fix export header',
    ]);
    expect(card.footnote).toBeUndefined();
  });

  it('keeps five rows and counts the rest past six', () => {
    const facts = Array.from({ length: 8 }, (_, index) => ({
      label: `Commit ${index + 1}`,
      value: `Step ${index + 1}`,
    }));

    const card = historyMarkCardOf({ label: 'Combines 8 commits', facts });

    expect(card.facts).toHaveLength(5);
    expect(card.footnote).toBe('and 3 more');
  });

  it('puts the explanation in the footnote after the row count', () => {
    const card = historyMarkCardOf({
      label: 'Folds into "Add ledger export" (fixup)',
      facts: [],
      note: "Only that commit's title is kept.",
    });

    expect(card.facts).toEqual([]);
    expect(card.footnote).toBe("Only that commit's title is kept.");
  });
});

describe('conflictCardOf', () => {
  it('names the files that conflict, one row each, as a warning', () => {
    const card = conflictCardOf({ conflictFiles: ['src/ledger.ts', 'src/export.ts'] });

    expect(card.state).toEqual({ tone: 'warning', words: 'Conflicts in 2 files' });
    expect(card.facts).toEqual([
      { label: 'File 1', value: 'src/ledger.ts' },
      { label: 'File 2', value: 'src/export.ts' },
    ]);
  });

  it('caps a long list', () => {
    const conflictFiles = Array.from({ length: 9 }, (_, index) => `src/file-${index}.ts`);

    const card = conflictCardOf({ conflictFiles });

    expect(card.facts).toHaveLength(5);
    expect(card.footnote).toBe('and 4 more');
  });
});
