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
      isLeftRail: false,
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

describe('shellArrangement, the legacy layout', () => {
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
      isLeftRail: false,
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

type Slot = 'none' | 'rail' | 'sessions' | 'column';

type Peek = 'none' | 'peek';

type Row = readonly [
  mode: 'column' | 'classic',
  hasWorkspace: boolean,
  hasActiveSession: boolean,
  isSidebarCollapsed: boolean,
  isSettingsOpen: boolean,
  leftSlot: Slot,
  leftOverlaySlot: Peek,
  studioCoversLeft: boolean,
];

const TABLE: ReadonlyArray<Row> = [
  ['column', false, false, false, false, 'column', 'none', false],
  ['column', false, false, false, true, 'column', 'none', false],
  ['column', false, false, true, false, 'rail', 'none', false],
  ['column', false, false, true, true, 'column', 'none', false],
  ['column', false, true, false, false, 'column', 'none', false],
  ['column', false, true, false, true, 'column', 'none', false],
  ['column', false, true, true, false, 'rail', 'none', false],
  ['column', false, true, true, true, 'column', 'none', false],
  ['column', true, false, false, false, 'column', 'none', false],
  ['column', true, false, false, true, 'column', 'none', false],
  ['column', true, false, true, false, 'rail', 'peek', false],
  ['column', true, false, true, true, 'column', 'none', false],
  ['column', true, true, false, false, 'column', 'none', false],
  ['column', true, true, false, true, 'column', 'none', false],
  ['column', true, true, true, false, 'rail', 'peek', false],
  ['column', true, true, true, true, 'column', 'none', false],
  ['classic', false, false, false, false, 'none', 'none', true],
  ['classic', false, false, false, true, 'none', 'none', true],
  ['classic', false, false, true, false, 'none', 'none', true],
  ['classic', false, false, true, true, 'none', 'none', true],
  ['classic', false, true, false, false, 'none', 'none', true],
  ['classic', false, true, false, true, 'none', 'none', true],
  ['classic', false, true, true, false, 'none', 'none', true],
  ['classic', false, true, true, true, 'none', 'none', true],
  ['classic', true, false, false, false, 'none', 'none', true],
  ['classic', true, false, false, true, 'none', 'none', true],
  ['classic', true, false, true, false, 'none', 'none', true],
  ['classic', true, false, true, true, 'none', 'none', true],
  ['classic', true, true, false, false, 'sessions', 'none', true],
  ['classic', true, true, false, true, 'sessions', 'none', true],
  ['classic', true, true, true, false, 'rail', 'peek', true],
  ['classic', true, true, true, true, 'rail', 'peek', true],
];

const label = ([mode, hasWorkspace, hasActiveSession, isSidebarCollapsed, isSettingsOpen]: Row) =>
  [
    mode,
    hasWorkspace ? 'workspace' : 'no workspace',
    hasActiveSession ? 'session' : 'no session',
    isSidebarCollapsed ? 'collapsed' : 'pinned',
    isSettingsOpen ? 'settings open' : 'settings closed',
  ].join(', ');

describe('shellArrangement, every combination of mode, workspace, session, sidebar and Settings', () => {
  it('covers each of the 32 combinations once', () => {
    expect(new Set(TABLE.map(label)).size).toBe(32);
  });

  it.each(TABLE.map((row) => [label(row), row] as const))(
    '%s',
    (
      _name,
      [mode, hasWorkspace, hasActiveSession, isSidebarCollapsed, isSettingsOpen, ...rest],
    ) => {
      const [leftSlot, leftOverlaySlot, studioCoversLeft] = rest;

      expect(
        shellArrangement({
          mode,
          hasWorkspace,
          hasActiveSession,
          isSidebarCollapsed,
          isSettingsOpen,
        }),
      ).toMatchObject({ leftSlot, leftOverlaySlot, studioCoversLeft });
    },
  );

  it('hands the column to Settings on a collapsed sidebar without touching the stored collapse', () => {
    const open = shellArrangement({
      hasWorkspace: true,
      hasActiveSession: true,
      isSidebarCollapsed: true,
      isSettingsOpen: true,
    });

    expect(open).toMatchObject({
      leftSlot: 'column',
      leftOverlaySlot: 'none',
      leftHidden: false,
      leftSidebarCollapsed: true,
      isLeftRail: false,
    });
  });

  it('gives the rail back, with its peek, once Settings closes', () => {
    const closed = shellArrangement({
      hasWorkspace: true,
      hasActiveSession: true,
      isSidebarCollapsed: true,
      isSettingsOpen: false,
    });

    expect(closed).toMatchObject({
      leftSlot: 'rail',
      leftOverlaySlot: 'peek',
      leftSidebarCollapsed: true,
      isLeftRail: true,
    });
  });

  it('draws the column at its pinned width exactly while it is not the rail', () => {
    for (const row of TABLE) {
      const [mode, hasWorkspace, hasActiveSession, isSidebarCollapsed, isSettingsOpen] = row;
      const arrangement = shellArrangement({
        mode,
        hasWorkspace,
        hasActiveSession,
        isSidebarCollapsed,
        isSettingsOpen,
      });

      expect(arrangement.isLeftRail, label(row)).toBe(arrangement.leftSlot === 'rail');
    }
  });

  it('is not moved by the Settings flag in the legacy layout', () => {
    for (const row of TABLE.filter(([mode]) => mode === 'classic')) {
      const [mode, hasWorkspace, hasActiveSession, isSidebarCollapsed] = row;
      const base = { mode, hasWorkspace, hasActiveSession, isSidebarCollapsed } as const;

      expect(shellArrangement({ ...base, isSettingsOpen: true }), label(row)).toEqual(
        shellArrangement({ ...base, isSettingsOpen: false }),
      );
    }
  });

  it('keeps the stored collapse as the sidebar preference on every column row', () => {
    for (const row of TABLE.filter(([mode]) => mode === 'column')) {
      const [mode, hasWorkspace, hasActiveSession, isSidebarCollapsed, isSettingsOpen] = row;

      expect(
        shellArrangement({
          mode,
          hasWorkspace,
          hasActiveSession,
          isSidebarCollapsed,
          isSettingsOpen,
        }).leftSidebarCollapsed,
        label(row),
      ).toBe(isSidebarCollapsed);
    }
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
