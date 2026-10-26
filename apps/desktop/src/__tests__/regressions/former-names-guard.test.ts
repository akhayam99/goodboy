// @vitest-environment node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { NAMES, formerNamesOf } from '../../shared/utils/names';
import { RETIRED_NAMES } from './retiredNames';

const BASELINE_PATH = join(__dirname, 'former-names-guard.baseline.json');
const UPDATE_FLAG = process.env.GOODBOY_UPDATE_BASELINE;

type NamesNode = string | { readonly [key: string]: NamesNode };

type Counts = Record<string, number>;

const labelsIn = ({ node }: { readonly node: NamesNode }): ReadonlyArray<string> =>
  typeof node === 'string'
    ? [node]
    : Object.values(node).flatMap((child) => labelsIn({ node: child }));

const isGuarded = ({ former }: { readonly former: string }): boolean =>
  RETIRED_NAMES.some((retired) => retired.pattern.test(former));

const unguarded = (): Counts =>
  Object.fromEntries(
    [...new Set(labelsIn({ node: NAMES }))]
      .flatMap((label) => formerNamesOf(label))
      .filter((former) => !isGuarded({ former }))
      .sort((a, b) => a.localeCompare(b))
      .map((former) => [former, 1]),
  );

const readBaseline = (): Counts => JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('every retired name is in the retired names guard', () => {
  const measured = unguarded();

  if (UPDATE_FLAG === '1') {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(measured, null, 2)}\n`);
  }

  it('guards each former name in names.ts, or lists it as a word that is still drawn elsewhere', () => {
    const baseline = readBaseline();
    const missing = Object.keys(measured).filter((former) => baseline[former] === undefined);

    expect(missing).toEqual([]);
  });

  it('guards the names this release retires', () => {
    [
      'Switch to dark mode',
      'Switch to light mode',
      'Unlink from this session',
      'Workflow rules',
      'Stop the answer',
      'Open a folder',
    ].forEach((former) => expect(isGuarded({ former })).toBe(true));
  });

  it.runIf(process.env.RATCHET_CLOSE === '1')('lists no word the guard now catches', () => {
    const stale = Object.keys(readBaseline()).filter((former) => measured[former] === undefined);

    expect(stale).toEqual([]);
  });
});
