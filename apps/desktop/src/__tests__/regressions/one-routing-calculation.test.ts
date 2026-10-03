// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

const BARE_KIND_ROUTING = /\bkindRouting\(/;

const CALCULATION = 'store/slices/agents/scopedKindRouting.ts';

const STEP_ROUTING_CALL = 'resolveStepRouting({';

const stepRoutingCalls = (text: string): ReadonlyArray<string> =>
  text
    .split(STEP_ROUTING_CALL)
    .slice(1)
    .map((rest) => {
      let depth = 1;
      const end = [...rest].findIndex((char) => {
        depth += char === '{' ? 1 : char === '}' ? -1 : 0;
        return depth === 0;
      });
      return rest.slice(0, end);
    });

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

const stepRoutingCallsWithoutScope = (): ReadonlyArray<string> =>
  walk(SRC).flatMap((path) =>
    stepRoutingCalls(readFileSync(path, 'utf8'))
      .filter((call) => !/\bscope\b/.test(call))
      .map(() => relative(SRC, path).split(sep).join('/')),
  );

const callers = (): ReadonlyArray<string> =>
  walk(SRC)
    .filter((path) => BARE_KIND_ROUTING.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path).split(sep).join('/'));

describe('one routing calculation', () => {
  it('asks what runs here only through selectKindRouting and its workspace twin', () => {
    expect(callers().filter((path) => path !== CALCULATION)).toEqual([]);
  });

  it('hands every step routing the workspace scope, so no path skips the provider policy', () => {
    expect(
      walk(SRC).filter((path) => stepRoutingCalls(readFileSync(path, 'utf8')).length > 0).length,
    ).toBeGreaterThan(3);
    expect(stepRoutingCallsWithoutScope()).toEqual([]);
  });
});
