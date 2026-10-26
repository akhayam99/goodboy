import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const QUERIES = fileURLToPath(new URL('.', import.meta.url));

const BASELINE: Readonly<Record<string, number>> = {};

const JSON_PARSE = /JSON\.parse\(/g;

type CountParams = {
  readonly file: string;
};

const countIn = ({ file }: CountParams): number =>
  (readFileSync(join(QUERIES, file), 'utf8').match(JSON_PARSE) ?? []).length;

describe('stored JSON in queries', () => {
  it('reads a stored column through parseJsonColumn, never a hand-rolled JSON.parse', () => {
    const files = readdirSync(QUERIES).filter(
      (entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'),
    );
    const grown = files.flatMap((file) => {
      const count = countIn({ file });
      const allowed = BASELINE[file] ?? 0;
      return count > allowed ? [`${file}: ${count} > ${allowed}`] : [];
    });
    expect(grown).toEqual([]);
  });

  it('keeps no baseline entry that no longer needs one', () => {
    const stale = Object.entries(BASELINE).flatMap(([file, allowed]) =>
      countIn({ file }) < allowed ? [`${file}: lower the baseline to ${countIn({ file })}`] : [],
    );
    expect(stale).toEqual([]);
  });
});
