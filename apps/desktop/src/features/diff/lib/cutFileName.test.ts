import { describe, expect, it } from 'vitest';
import { cutFileName } from './cutFileName';

describe('cutFileName', () => {
  const table: ReadonlyArray<readonly [string, string, number, string]> = [
    ['the owner example', 'StatementBalanceCard.test.tsx', 22, 'Statem…ceCard.test.tsx'],
    ['a short name stays whole', 'index.ts', 22, 'index.ts'],
    ['a name exactly at the budget stays whole', 'ledger.module.css', 17, 'ledger.module.css'],
    [
      'a double extension keeps the whole chain',
      'LedgerRowStatement.stories.tsx',
      24,
      'Ledge…tement.stories.tsx',
    ],
    [
      'a dotfile keeps its leading dot in the stem',
      '.eslintrc.production.json',
      24,
      '.es…ntrc.production.json',
    ],
    ['no extension cuts the stem only', 'StatementBalanceCardVariants', 16, 'Statement…riants'],
    ['an empty name stays empty', '', 10, ''],
    ['one character stays whole', 'a', 1, 'a'],
    [
      'a budget below the chain falls back to the right edge',
      'StatementBalanceCard.test.tsx',
      8,
      '…est.tsx',
    ],
  ];

  it.each(table)('%s', (_label, name, maxLength, expected) => {
    expect(cutFileName({ name, maxLength })).toBe(expected);
  });

  it('keeps the budget on 100k characters', () => {
    const name = `${'a'.repeat(100_000)}.test.tsx`;
    const cut = cutFileName({ name, maxLength: 24 });
    expect(cut.length).toBeLessThanOrEqual(24);
    expect(cut.endsWith('.test.tsx')).toBe(true);
  });
});
