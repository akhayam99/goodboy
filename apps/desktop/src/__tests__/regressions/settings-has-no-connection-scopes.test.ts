// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const OPEN_SETTINGS_ON_MOVED_SCOPE = /openSettings\w*\(\s*\{[^)]*?scope:\s*'(?:providers|tools)'/;
const SETTINGS_PLACE_ON_MOVED_SCOPE =
  /kind:\s*'settings',\s*focus:\s*\{\s*scope:\s*'(?:providers|tools)'/;

const isSource = (entry: string): boolean =>
  (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
  !entry.endsWith('.test.ts') &&
  !entry.endsWith('.test.tsx');

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (isSource(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe('providers and integrations live in Connections', () => {
  it('opens no Settings page on the providers or tools scope', () => {
    const offenders = listSourceFiles(DESKTOP_SRC).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return OPEN_SETTINGS_ON_MOVED_SCOPE.test(source) || SETTINGS_PLACE_ON_MOVED_SCOPE.test(source)
        ? [relative(DESKTOP_SRC, file)]
        : [];
    });

    expect(
      offenders,
      `Open the page through features/connections/openConnection.ts instead:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('catches both shapes of an old link', () => {
    expect(
      OPEN_SETTINGS_ON_MOVED_SCOPE.test("openSettings({\n  scope: 'providers', provider })"),
    ).toBe(true);
    expect(OPEN_SETTINGS_ON_MOVED_SCOPE.test("openSettingsDoor({ scope: 'tools' })")).toBe(true);
    expect(
      SETTINGS_PLACE_ON_MOVED_SCOPE.test("studio: { kind: 'settings', focus: { scope: 'tools' } }"),
    ).toBe(true);
    expect(OPEN_SETTINGS_ON_MOVED_SCOPE.test("openSettings({ scope: 'workspace' })")).toBe(false);
  });
});
