import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

const ALLOWED_FILES: ReadonlySet<string> = new Set(['migrations/runner.ts']);

const TRANSACTION_LITERAL = /['"`]\s*(?:BEGIN|COMMIT|ROLLBACK)\b/;

type SourceFilesParams = {
  readonly directory: string;
};

const sourceFiles = ({ directory }: SourceFilesParams): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles({ directory: path });
    }
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });

describe('transactions', () => {
  it('opens no transaction by hand outside the migration runner', () => {
    const offenders = sourceFiles({ directory: SRC }).flatMap((path) => {
      const file = relative(SRC, path);
      if (ALLOWED_FILES.has(file)) {
        return [];
      }
      return readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, index) => (TRANSACTION_LITERAL.test(line) ? [`${file}:${index + 1}`] : []));
    });

    expect(offenders).toEqual([]);
  });
});
