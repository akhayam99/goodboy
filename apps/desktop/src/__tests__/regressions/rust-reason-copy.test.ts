// @vitest-environment node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const RUST_ROOT = join(__dirname, '..', '..', '..', 'src-tauri', 'src');
const BASELINE_PATH = join(__dirname, 'rust-reason-copy.baseline.json');
const UPDATE_FLAG = process.env.GOODBOY_UPDATE_BASELINE;

const FAILURE_SENTENCE = /"[^"\n]*\b(?:couldn't|could not|cannot|can't)\b[^"\n]*"/i;

type Counts = Record<string, number>;

type WalkParams = {
  readonly directory: string;
};

const walk = ({ directory }: WalkParams): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      return entry === 'tests' || entry === 'test_support' ? [] : walk({ directory: full });
    }
    return entry.endsWith('.rs') && !entry.startsWith('tests') ? [full] : [];
  });

const measure = (): Counts => {
  const counts: Counts = {};
  walk({ directory: RUST_ROOT }).forEach((path) => {
    const lines = readFileSync(path, 'utf8').split('\n');
    const testStart = lines.findIndex((line) => line.trim() === '#[cfg(test)]');
    const production = testStart === -1 ? lines : lines.slice(0, testStart);
    const count = production.filter((line) => FAILURE_SENTENCE.test(line)).length;
    if (count > 0) {
      counts[relative(RUST_ROOT, path).split(sep).join('/')] = count;
    }
  });
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};

const readBaseline = (): Counts => JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('Rust returns reason codes, not failure sentences', () => {
  const measured = measure();

  if (UPDATE_FLAG === '1') {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(measured, null, 2)}\n`);
  }

  it('converted files stay free of failure sentences', () => {
    ['history/preflight.rs', 'history/dirty.rs'].forEach((file) => {
      expect(measured[file] ?? 0).toBe(0);
    });
  });

  it('never grows a file count past the baseline', () => {
    const baseline = readBaseline();
    const grown = Object.entries(measured).filter(([file, count]) => count > (baseline[file] ?? 0));
    expect(Object.fromEntries(grown)).toEqual({});
  });
});
