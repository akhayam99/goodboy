// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..');
const FUTURE_MODEL_COPY = /not chosen yet/i;

const sourcesUnder = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' ? [] : sourcesUnder(path);
    }
    const isSource = /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
    return isSource ? [path] : [];
  });

describe('a missing model reads as unknown, never as a future choice', () => {
  it('has no "not chosen yet" copy in the app', () => {
    const offenders = sourcesUnder(SRC_ROOT).filter((path) =>
      FUTURE_MODEL_COPY.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
