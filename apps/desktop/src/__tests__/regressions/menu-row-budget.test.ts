// @vitest-environment node
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MAX_OVERFLOW_ROWS } from '../../features/actions/overflowCutOf';
import { DESKTOP_SRC, desktopSources, isTestSource } from '../helpers/sourceImports';

const MENU_ROOTS: ReadonlyArray<string> = ['app/', 'features/', 'shared/'];

const NOT_MENU_ROOTS: ReadonlyArray<string> = ['app/components/MockScene/', 'features/actions/'];

const MENU_MARKERS: ReadonlyArray<string> = [
  'MenuEntry',
  '<OverflowMenu',
  '<MenuList',
  '<AppMenuList',
];

const LITERAL_ITEM = /kind:\s*'item'/g;

const PENDING: Readonly<Record<string, string>> = {
  'app/components/GoodboyChip/GoodboyMenu.tsx':
    'the Goodboy chip menu goes away with the foot rework, which moves its rows to pages',
};

const EXEMPT: Readonly<Record<string, string>> = {
  '../src-tauri/src/app_menu.rs': 'the native menu bar: the Go menu lists every door',
  'features/actions/components/ObjectMenuProvider/ObjectContextMenu.tsx':
    'right click object menus mirror the action catalog',
};

type PathParams = {
  readonly path: string;
};

const readSource = ({ path }: PathParams): string => readFileSync(join(DESKTOP_SRC, path), 'utf8');

const isMenuSource = ({ path }: PathParams): boolean =>
  !isTestSource(path) &&
  MENU_ROOTS.some((root) => path.startsWith(root)) &&
  !NOT_MENU_ROOTS.some((root) => path.startsWith(root)) &&
  MENU_MARKERS.some((marker) => readSource({ path }).includes(marker));

const literalRowsOf = ({ path }: PathParams): number =>
  readSource({ path }).match(LITERAL_ITEM)?.length ?? 0;

const menuSources = desktopSources().filter((path) => isMenuSource({ path }));

describe('a menu the app draws holds at most five rows', () => {
  it('reads the hand written menus of the shell and the features', () => {
    expect(menuSources.length).toBeGreaterThan(10);
    expect(menuSources.some((path) => literalRowsOf({ path }) > 0)).toBe(true);
  });

  it('writes no more than five literal rows in any menu source', () => {
    const over = menuSources
      .filter((path) => PENDING[path] === undefined)
      .map((path) => ({ path, rows: literalRowsOf({ path }) }))
      .filter(({ rows }) => rows > MAX_OVERFLOW_ROWS);
    expect(over).toEqual([]);
  });

  it('keeps the pending list shrinking: a listed file still holds more than five rows', () => {
    const stale = Object.keys(PENDING).filter(
      (path) => existsSync(join(DESKTOP_SRC, path)) && literalRowsOf({ path }) <= MAX_OVERFLOW_ROWS,
    );
    expect(stale).toEqual([]);
  });

  it('leaves registry menus to the per state measures of the overflow inventory', () => {
    const inventory = readSource({ path: '__tests__/actions/overflowRows.test.ts' });
    expect(inventory).toContain('MAX_OVERFLOW_ROWS');
    expect(inventory).toContain('the overflow inventory is derived from the source');
  });

  it('names what the rule leaves out, and each exempt menu still exists', () => {
    const gone = Object.keys(EXEMPT).filter((path) => !existsSync(join(DESKTOP_SRC, path)));
    expect(gone).toEqual([]);
  });
});
