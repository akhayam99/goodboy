// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const ROOT = join(SRC, '..', '..', '..');

const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.test\.(ts|tsx)$/;

const BASELINE: ReadonlyArray<string> = [
  'apps/desktop/src/features/resolve/components/ReviewFlow/index.tsx',
];

const ERROR_AS_BODY = /<EmptyState\b[^>]*\bdescription=\{\s*[\w.?]*(?:[eE]rror|[mM]essage)\w*\s*\}/;

const filesUnder = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' ? [] : filesUnder(path);
    }
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });

describe('an empty state never carries a raw error string', () => {
  it('uses a sentence, with the raw text behind Details', () => {
    const offenders = filesUnder(SRC)
      .filter((path) => ERROR_AS_BODY.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ROOT, path));

    expect(offenders).toEqual(BASELINE);
  });

  it('flags a raw error passed as the description', () => {
    expect(ERROR_AS_BODY.test('<EmptyState title="x" description={rootError} />')).toBe(true);
    expect(ERROR_AS_BODY.test('<EmptyState title="x" description="Nothing here yet" />')).toBe(
      false,
    );
  });
});
