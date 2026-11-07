// @vitest-environment node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { scanCopy } from './scanCopy';

const BASELINE_PATH = join(__dirname, 'contractions-copy.baseline.json');
const UPDATE_FLAG = process.env.GOODBOY_UPDATE_BASELINE;

const SPELLED_OUT = /\b(?:could not|cannot|do not|does not|is not|are not|will not|have not)\b/i;

type Counts = Record<string, number>;

const measure = (): Counts =>
  scanCopy()
    .filter((copy) => SPELLED_OUT.test(copy.text))
    .reduce<Counts>((byPath, copy) => {
      byPath[copy.path] = (byPath[copy.path] ?? 0) + 1;
      return byPath;
    }, {});

const sorted = (counts: Counts): Counts =>
  Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

const readBaseline = (): Counts => JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('on-screen copy uses contractions', () => {
  const measured = measure();

  if (UPDATE_FLAG === '1') {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted(measured), null, 2)}\n`);
  }

  it.each([
    'Could not load commits',
    'Goodboy cannot reach this folder',
    'This does not sign you out',
    'It is not installed',
    'They are not kept',
    'It will not run',
    'We have not checked',
    'Do not change files',
  ])('flags %s', (text) => {
    expect(SPELLED_OUT.test(text)).toBe(true);
  });

  it.each([
    "Couldn't load commits",
    "Goodboy can't reach this folder",
    'Nothing was changed',
    'Cannon fire',
  ])('leaves %s alone', (text) => {
    expect(SPELLED_OUT.test(text)).toBe(false);
  });

  it('adds no spelled out negation to rendered copy outside the baseline', () => {
    const baseline = readBaseline();
    const grown = Object.entries(measured).flatMap(([path, count]) => {
      const allowed = baseline[path] ?? 0;
      return count > allowed
        ? [`  - ${path}: ${count} (baseline ${allowed}), write the contraction (Couldn't, can't)`]
        : [];
    });

    expect(grown).toEqual([]);
  });

  it.runIf(process.env.RATCHET_CLOSE === '1')(
    'has no baseline count above what is measured',
    () => {
      const stale = Object.entries(readBaseline()).flatMap(([path, allowed]) => {
        const count = measured[path] ?? 0;
        return count < allowed ? [`${path}: baseline ${allowed}, now ${count}`] : [];
      });

      expect(stale).toEqual([]);
    },
  );
});
