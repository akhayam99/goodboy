// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = __dirname;
const NETWORK =
  /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|https?:\/\/(?!testflight\.apple\.com)/;

type WalkParams = {
  readonly dir: string;
};

const sourcesOf = ({ dir }: WalkParams): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourcesOf({ dir: path });
    }
    const isSource = /\.tsx?$/.test(name) && !name.includes('.test.');
    return isSource ? [path] : [];
  });

describe('the iPhone link makes no network call of its own', () => {
  it('has no fetch, socket or web address in the companion components and the bar icon', () => {
    const offenders = sourcesOf({ dir: join(ROOT, 'components') }).filter((path) =>
      NETWORK.test(readFileSync(path, 'utf8')),
    );

    expect(offenders.map((path) => relative(ROOT, path))).toEqual([]);
  });

  it('keeps the TestFlight link in one constant that is empty until the owner gives it', () => {
    const source = readFileSync(join(ROOT, 'testflightLink.ts'), 'utf8');

    expect(source.trim()).toBe("export const TESTFLIGHT_LINK = '';");
  });
});
