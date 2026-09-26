import { describe, expect, it } from 'vitest';
import type { RunnableScript } from './buildSessionScripts';
import { defaultClosedPackageKeys } from './defaultClosedPackageKeys';
import type { ScriptPackageSection } from './groupScriptsByPackage';

const NOW = new Date('2026-09-16T11:00:00.000Z').getTime();

const script = (key: string): RunnableScript => ({
  key,
  kind: 'manifest',
  name: 'dev',
  body: 'vite',
  invocation: 'yarn run dev',
  manager: 'yarn',
  source: 'package-json',
  packageName: key,
  relDir: key,
  category: 'dev',
  savedId: null,
});

const section = (key: string, relDir: string): ScriptPackageSection => ({
  key,
  source: 'package-json',
  packageName: key,
  relDir,
  scripts: [script(key)],
});

describe('defaultClosedPackageKeys', () => {
  it('keeps every package open at or below the threshold', () => {
    const sections = Array.from({ length: 6 }, (_, index) =>
      section(`p${index}`, `apps/p${index}`),
    );
    expect(
      defaultClosedPackageKeys({
        sections,
        packageCount: 6,
        runningKeys: new Set(),
        startedAtByKey: {},
        now: NOW,
      }).size,
    ).toBe(0);
  });

  it('closes packages beyond the threshold, but never the root, a running one or one used today', () => {
    const sections = [
      section('root', ''),
      ...Array.from({ length: 7 }, (_, index) => section(`p${index}`, `apps/p${index}`)),
    ];
    const closed = defaultClosedPackageKeys({
      sections,
      packageCount: 8,
      runningKeys: new Set(['p0']),
      startedAtByKey: { p1: NOW },
      now: NOW,
    });

    expect(closed.has('root')).toBe(false);
    expect(closed.has('p0')).toBe(false);
    expect(closed.has('p1')).toBe(false);
    expect(closed.has('p2')).toBe(true);
    expect(closed.has('p6')).toBe(true);
  });

  it('leaves a package used on an earlier day closed', () => {
    const sections = [
      section('root', ''),
      ...Array.from({ length: 7 }, (_, index) => section(`p${index}`, `apps/p${index}`)),
    ];
    const closed = defaultClosedPackageKeys({
      sections,
      packageCount: 8,
      runningKeys: new Set(),
      startedAtByKey: { p1: new Date('2026-09-10T09:00:00.000Z').getTime() },
      now: NOW,
    });

    expect(closed.has('p1')).toBe(true);
  });
});
