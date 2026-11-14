// @vitest-environment node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MAX_OVERFLOW_ROWS } from '../../features/actions/overflowCutOf';
import { menuRowsOf } from '../helpers/menuRowsOf';
import { DESKTOP_SRC, desktopSources, isTestSource } from '../helpers/sourceImports';

const MENU_ROOTS: ReadonlyArray<string> = ['app/', 'features/', 'shared/'];

const EXEMPT_ROOTS: Readonly<Record<string, string>> = {
  'app/components/MockScene/': 'scenes draw menus only to show them',
  'features/actions/':
    'right click menus mirror the action catalog and registry menus are measured per state in overflowRows.test.ts',
};

const MENU_MARKERS: ReadonlyArray<string> = [
  'MenuEntry',
  '<OverflowMenu',
  '<MenuList',
  '<AppMenuList',
  'toMenuEntries',
];

const PENDING: Readonly<Record<string, string>> = {
  'app/components/GoodboyChip/GoodboyMenu.tsx':
    'the Goodboy chip menu goes away with the foot rework, which moves its rows to pages',
};

const DATA_DRIVEN: Readonly<Record<string, string>> = {
  'app/components/AppTopBar/NavCluster/HistoryArrow.tsx':
    'a radio list of the last twelve stops of the history stack, a list and not a menu of fixed rows',
  'features/branch/components/BranchHeader/BranchOverflow.tsx':
    'rows built from registry actions, capped by branchMenuRows.test.ts',
  'features/search/components/SearchMode/SearchHitActions.tsx':
    'registry actions of one hit, capped at two by RELATED_LIMIT and pinned in SearchMode/index.test.tsx',
  'features/chat/components/ChatInput/parts/ComposerPlusMenu.tsx':
    'one row per prefix group the composer knows',
  'features/diff/FilesMode/ExploreProjectChip.tsx': 'a picker over the projects of the workspace',
  'features/integrations/jira/AssigneePicker.tsx': 'a picker over the people of a Jira project',
  'features/integrations/jira/TransitionMenu.tsx': 'the transitions Jira offers for one issue',
  'features/integrations/linear/LinearAssigneeMenu.tsx': 'a picker over the people of a team',
  'features/integrations/linear/LinearStateMenu.tsx': 'the states of a Linear team',
  'features/session/components/TaskPlacement/PutOnBranchPopover.tsx':
    'a picker over the branches of the project',
  'features/terminal/components/TerminalStudio/NewTerminalMenu.tsx':
    'a picker over the projects and branches that can host a terminal',
  'features/wireframes/components/WireframeViewer/RevisionPicker.tsx':
    'a picker over the revisions of one wireframe',
};

type PathParams = {
  readonly path: string;
};

const isMenuSource = ({ path }: PathParams): boolean =>
  !isTestSource(path) &&
  MENU_ROOTS.some((root) => path.startsWith(root)) &&
  !Object.keys(EXEMPT_ROOTS).some((root) => path.startsWith(root)) &&
  MENU_MARKERS.some((marker) => readFileSync(join(DESKTOP_SRC, path), 'utf8').includes(marker));

const report = desktopSources()
  .filter((path) => isMenuSource({ path }))
  .map((path) => ({ path, ...menuRowsOf({ path }) }));

const rowsOfMenus = report.filter(({ rows }) => rows > 0);

describe('a menu the app draws holds at most five rows', () => {
  it('reads the hand written menus of the shell and the features', () => {
    expect(report.length).toBeGreaterThan(10);
    expect(rowsOfMenus.length).toBeGreaterThan(5);
  });

  it('counts every row it can see: literal items, radio choices and mapped lists of a constant, and names a menu built from data or from toMenuEntries', () => {
    const uncounted = report
      .filter(({ unresolved }) => unresolved.length > 0)
      .map(({ path }) => path)
      .filter((path) => DATA_DRIVEN[path] === undefined);
    expect(uncounted).toEqual([]);
  });

  it('keeps the history list at the twelve stops its reason names', () => {
    const source = readFileSync(
      join(DESKTOP_SRC, 'app/components/AppTopBar/NavCluster/index.tsx'),
      'utf8',
    );
    expect(source).toContain('HISTORY_MENU_LIMIT = 12;');
  });

  it('keeps the data driven list shrinking: a listed menu still builds rows from data', () => {
    const stale = Object.keys(DATA_DRIVEN).filter(
      (path) => menuRowsOf({ path }).unresolved.length === 0,
    );
    expect(stale).toEqual([]);
  });

  it.each(rowsOfMenus.map(({ path, rows }) => [path, rows] as const))(
    '%s holds %i literal rows across all its menus',
    (path, rows) => {
      if (PENDING[path] !== undefined) {
        expect(rows).toBeGreaterThan(MAX_OVERFLOW_ROWS);
        return;
      }
      expect(rows).toBeLessThanOrEqual(MAX_OVERFLOW_ROWS);
    },
  );

  it('keeps the pending list shrinking: a listed file still holds more than five rows', () => {
    const stale = Object.keys(PENDING).filter(
      (path) =>
        existsSync(join(DESKTOP_SRC, path)) && menuRowsOf({ path }).rows <= MAX_OVERFLOW_ROWS,
    );
    expect(stale).toEqual([]);
  });

  it('skips only the roots it names, and each of them still exists', () => {
    const gone = Object.keys(EXEMPT_ROOTS).filter((root) => !existsSync(join(DESKTOP_SRC, root)));
    expect(gone).toEqual([]);
  });
});
