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
  it('lays out the one column on the board, with no footer and studios beside it', () => {
    expect(
      shellArrangement({ hasWorkspace: true, hasActiveSession: false, isSidebarCollapsed: false }),
    ).toEqual({
      mode: 'column',
      footer: null,
      columnScope: 'workspace',
      leftHidden: false,
      leftSidebarCollapsed: false,
      leftSlot: 'column',
      leftOverlaySlot: 'none',
      studioCoversLeft: false,
    });
  });

  it('keeps the same column inside a session, so the frame never changes shape', () => {
    expect(
      shellArrangement({ hasWorkspace: true, hasActiveSession: true, isSidebarCollapsed: false }),
    ).toEqual(
      shellArrangement({ hasWorkspace: true, hasActiveSession: false, isSidebarCollapsed: false }),
    );
  });

  it('collapses to the rail of doors on every screen and arms the peek', () => {
    for (const hasActiveSession of [true, false]) {
      expect(
        shellArrangement({ hasWorkspace: true, hasActiveSession, isSidebarCollapsed: true }),
      ).toMatchObject({
        leftHidden: false,
        leftSidebarCollapsed: true,
        leftSlot: 'rail',
        leftOverlaySlot: 'peek',
        footer: null,
      });
    }
  });

  it('keeps only the app half of the column before any workspace exists', () => {
    expect(
      shellArrangement({ hasWorkspace: false, hasActiveSession: false, isSidebarCollapsed: false }),
    ).toMatchObject({
      columnScope: 'app',
      leftSlot: 'column',
      footer: null,
    });
    expect(
      shellArrangement({ hasWorkspace: false, hasActiveSession: false, isSidebarCollapsed: true }),
    ).toMatchObject({ leftSlot: 'rail', leftOverlaySlot: 'none' });
  });
});

describe('shellArrangement, the classic bars', () => {
  const classic = (params: {
    readonly hasWorkspace: boolean;
    readonly hasActiveSession: boolean;
    readonly isSidebarCollapsed: boolean;
  }) => shellArrangement({ ...params, mode: 'classic' });

  it('hides the column on the board, where there is no sessions list to show', () => {
    expect(
      classic({ hasWorkspace: true, hasActiveSession: false, isSidebarCollapsed: false }),
    ).toEqual({
      mode: 'classic',
      footer: 'workspace',
      columnScope: 'workspace',
      leftHidden: true,
      leftSidebarCollapsed: false,
      leftSlot: 'none',
      leftOverlaySlot: 'none',
      studioCoversLeft: true,
    });
  });

  it('ignores a stale collapse preference while no session is open', () => {
    expect(
      classic({ hasWorkspace: true, hasActiveSession: false, isSidebarCollapsed: true }),
    ).toMatchObject({ leftHidden: true, leftSlot: 'none', leftOverlaySlot: 'none' });
  });

  it('lays out the sessions column inside a session', () => {
    expect(
      classic({ hasWorkspace: true, hasActiveSession: true, isSidebarCollapsed: false }),
    ).toMatchObject({
      footer: 'workspace',
      leftHidden: false,
      leftSidebarCollapsed: false,
      leftSlot: 'sessions',
      leftOverlaySlot: 'none',
      studioCoversLeft: true,
    });
  });

  it('swaps the column for the rail and arms peek once collapsed', () => {
    expect(
      classic({ hasWorkspace: true, hasActiveSession: true, isSidebarCollapsed: true }),
    ).toMatchObject({
      leftHidden: false,
      leftSidebarCollapsed: true,
      leftSlot: 'rail',
      leftOverlaySlot: 'peek',
    });
  });

  it('keeps an app footer with no workspace, which no session can outlive', () => {
    expect(
      classic({ hasWorkspace: false, hasActiveSession: true, isSidebarCollapsed: false }),
    ).toMatchObject({ footer: 'app', leftHidden: true, leftSlot: 'none' });
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
        /left(Hidden|SidebarCollapsed)/.test(
          source.replace(/left(Hidden|SidebarCollapsed)=\{arrangement\.\w+\}/g, ''),
        ),
      )
      .map(({ path }) => path);
    expect(literals).toEqual([]);
  });
});
