// @vitest-environment node
import { readFileSync, readdirSync } from 'fs';
import { join, resolve, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { shellArrangement } from './index';

const DESKTOP_SRC = resolve(__dirname, '..', '..');

const sourceFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [full] : [];
  });

const shellMounts = (): ReadonlyArray<{ readonly path: string; readonly source: string }> =>
  sourceFiles(DESKTOP_SRC)
    .filter(
      (path) =>
        !path.includes('__tests__') && !path.endsWith('.test.tsx') && !path.endsWith('.test.ts'),
    )
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => source.includes('<AppShell'));

describe('shellArrangement, the column', () => {
  it('lays out the one column on the board with studios beside it', () => {
    expect(shellArrangement({ hasWorkspace: true, isSidebarCollapsed: false })).toEqual({
      columnScope: 'workspace',
      leftSidebarCollapsed: false,
      isLeftRail: false,
      leftSlot: 'column',
      leftOverlaySlot: 'none',
    });
  });

  it('collapses to the rail of doors and arms the peek', () => {
    expect(shellArrangement({ hasWorkspace: true, isSidebarCollapsed: true })).toMatchObject({
      leftSidebarCollapsed: true,
      leftSlot: 'rail',
      leftOverlaySlot: 'peek',
    });
  });

  it('keeps only the app half of the column before any workspace exists', () => {
    expect(shellArrangement({ hasWorkspace: false, isSidebarCollapsed: false })).toMatchObject({
      columnScope: 'app',
      leftSlot: 'column',
    });
    expect(shellArrangement({ hasWorkspace: false, isSidebarCollapsed: true })).toMatchObject({
      leftSlot: 'rail',
      leftOverlaySlot: 'none',
    });
  });

  it('takes no page as input, so no page can open or fold the column', () => {
    const source = readFileSync(join(__dirname, 'index.ts'), 'utf8');

    expect(source).not.toMatch(/settings|appStudio/i);
  });
});

describe('every shell mount, the app and the mock scenes alike', () => {
  it('roots the sweep at the desktop source tree, not at the folder it lives in', () => {
    expect(DESKTOP_SRC.endsWith(join('apps', 'desktop', 'src'))).toBe(true);
    expect(DESKTOP_SRC.endsWith(join('src', 'app'))).toBe(false);
  });

  it('walks past its own folder, so a mount outside src/app cannot hide from it', () => {
    const appRoot = `${join(DESKTOP_SRC, 'app')}${sep}`;
    const pathsOutsideApp = sourceFiles(DESKTOP_SRC).filter((path) => !path.startsWith(appRoot));

    expect(pathsOutsideApp.length).toBeGreaterThan(0);
  });

  it('finds the composition root and every scene to police, never an empty sweep', () => {
    const paths = shellMounts().map(({ path }) => path);

    expect(paths).toContain(join(DESKTOP_SRC, 'App.tsx'));
    expect(paths.filter((path) => path.includes('MockScene')).length).toBeGreaterThanOrEqual(2);
  });

  it('derives its arrangement from the helper instead of hand picking one', () => {
    expect(shellMounts().length).toBeGreaterThan(0);
    const handPicked = shellMounts()
      .filter(({ source }) => !/from '[^']*shellArrangement'/.test(source))
      .map(({ path }) => path);
    expect(handPicked).toEqual([]);
  });

  it('never writes a literal into the shell layout props', () => {
    expect(shellMounts().length).toBeGreaterThan(0);
    const literals = shellMounts()
      .filter(({ source }) =>
        /leftSidebarCollapsed/.test(
          source.replace(/leftSidebarCollapsed=\{arrangement\.\w+\}/g, ''),
        ),
      )
      .map(({ path }) => path);
    expect(literals).toEqual([]);
  });
});
