// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const LITERAL_EVENT = /new CustomEvent\(\s*'goodboy:/g;
const DISPATCHER_FOLDER = 'shared/lib/dispatchWindowEvent/';

const ALLOWED: Readonly<Record<string, number>> = {
  'features/companion/commandExecutor.ts': 1,
  'shared/utils/openAgentReveal.ts': 1,
};

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

const toPath = (full: string): string => relative(DESKTOP_SRC, full).split(sep).join('/');

const isProductSource = (path: string): boolean =>
  /\.tsx?$/.test(path) &&
  !path.endsWith('.d.ts') &&
  !/\.test\.tsx?$/.test(path) &&
  !path.startsWith('__tests__/') &&
  !path.startsWith('test/') &&
  !path.startsWith(DISPATCHER_FOLDER);

const productSources = (): ReadonlyArray<string> =>
  walk(DESKTOP_SRC).map(toPath).filter(isProductSource);

const countLiteralEvents = (text: string): number => (text.match(LITERAL_EVENT) ?? []).length;

const measure = (): Readonly<Record<string, number>> =>
  Object.fromEntries(
    productSources()
      .map(
        (path) =>
          [path, countLiteralEvents(readFileSync(join(DESKTOP_SRC, path), 'utf8'))] as const,
      )
      .filter(([, count]) => count > 0),
  );

describe('window events go through the dispatcher', () => {
  it('scans the store, the features and the shell, never an empty sweep', () => {
    const sources = productSources();

    expect(sources.some((path) => path.startsWith('store/slices/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('features/'))).toBe(true);
    expect(sources.some((path) => path.startsWith('app/'))).toBe(true);
    expect(sources).not.toContain('shared/lib/dispatchWindowEvent/index.ts');
  });

  it('recognises a hand-built event with a literal name, and nothing else', () => {
    expect(countLiteralEvents("window.dispatchEvent(new CustomEvent('goodboy:new-session'))")).toBe(
      1,
    );
    expect(countLiteralEvents("new CustomEvent(\n  'goodboy:open-settings', {})")).toBe(1);
    expect(countLiteralEvents('new CustomEvent(NOTIFICATIONS_STUDIO_EVENT)')).toBe(0);
    expect(countLiteralEvents("dispatchWindowEvent({ name: 'goodboy:new-session' })")).toBe(0);
  });

  it('adds no hand-built event with a literal name beyond the allowlist', () => {
    const grown = Object.entries(measure()).flatMap(([path, count]) => {
      const allowed = ALLOWED[path] ?? 0;
      return count > allowed ? [`  - ${path}: ${count} (allowed ${allowed})`] : [];
    });

    expect(
      grown,
      `send a window event with dispatchWindowEvent from shared/lib/dispatchWindowEvent, and ` +
        `the settings studio with openSettings (docs/event-bus.md). The allowlist only ` +
        `shrinks:\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the settings studio event behind openSettings', () => {
    const offenders = productSources().filter((path) => {
      if (path === 'features/settings/openSettings.ts') {
        return false;
      }
      const text = readFileSync(join(DESKTOP_SRC, path), 'utf8');
      return /name:\s*'goodboy:open-settings'/.test(text);
    });

    expect(offenders).toEqual([]);
  });

  it('drops an allowlist entry once its hand-built event is gone', () => {
    const current = measure();
    const stale = Object.entries(ALLOWED).flatMap(([path, allowed]) => {
      const count = current[path] ?? 0;
      return count < allowed ? [`  - ${path}: ${count} (allowed ${allowed})`] : [];
    });

    expect(stale, `lower or delete these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
