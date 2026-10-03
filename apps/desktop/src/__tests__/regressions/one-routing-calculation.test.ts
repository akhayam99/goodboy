// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

const BARE_KIND_ROUTING = /\bkindRouting\(/;

const CALCULATION = 'store/slices/agents/scopedKindRouting.ts';

const WAITING_FOR_THE_POLICY_SWITCH: ReadonlyArray<string> = [
  'features/workflows/resolveStepRouting.ts',
];

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`) &&
  !path.includes(`${sep}mocks${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

const callers = (): ReadonlyArray<string> =>
  walk(SRC)
    .filter((path) => BARE_KIND_ROUTING.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path).split(sep).join('/'));

describe('one routing calculation', () => {
  it('asks what runs here only through selectKindRouting and its workspace twin', () => {
    expect(
      callers().filter(
        (path) => path !== CALCULATION && !WAITING_FOR_THE_POLICY_SWITCH.includes(path),
      ),
    ).toEqual([]);
  });

  it('only shrinks the written exceptions', () => {
    const found = callers();
    expect(WAITING_FOR_THE_POLICY_SWITCH.filter((path) => !found.includes(path))).toEqual([]);
  });
});
