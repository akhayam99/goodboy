// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app', 'shared'];
const REGISTRY_ROOT = 'features/actions/';

const HAND_BUILT_MENU = /<OverflowMenu\b|<MenuList\b|<ContextMenu\b/;

const HAND_BUILT_MENU_ROLE =
  /\srole=(?:["']|\{[^}\n]*?[?:]\s*["'])(?:menu|menuitem|menuitemradio|menuitemcheckbox)["']/;

const ALLOWED: Readonly<Record<string, string>> = {
  'features/branch/components/BranchHeader/BranchOverflow.tsx':
    'branch header menu: its entries come from the pull request and diff kinds of the registry',
  'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx':
    'settings page menu (Restore defaults, Copy from), page chrome',
  'features/workflows/components/WorkflowStudio/WorkflowEditor/EditorTrail.tsx':
    'workflow editor band actions, studio chrome',
  'features/search/components/SearchMode/SearchHitActions.tsx':
    'search preview: lists the registry verbs of the hit through toMenuEntries',
  'features/storage/components/StoragePage/ArtifactRowActions.tsx':
    'artifact files from deleted sessions: storage keep and delete',
  'features/session/components/TaskPlacement/PutOnBranchPopover.tsx':
    'task picker: chooses a linked task for a branch, a value picker',
};

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

const offenders = (): ReadonlyArray<string> =>
  SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root)))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .filter((path) => !path.startsWith(REGISTRY_ROOT))
    .filter((path) => HAND_BUILT_MENU.test(readFileSync(join(SRC, path), 'utf8')));

const roleOffenders = (): ReadonlyArray<string> =>
  SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root)))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .filter((path) => HAND_BUILT_MENU_ROLE.test(readFileSync(join(SRC, path), 'utf8')));

const ITEMS_OPENING = 'entries={[';

type BracketParams = {
  readonly source: string;
  readonly from: number;
};

const closingBracket = ({ source, from }: BracketParams) => {
  let depth = 0;
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (char === '[' || char === '{' || char === '(') {
      depth += 1;
    }
    if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
    }
    if (depth === 0) {
      return index;
    }
  }
  return source.length;
};

type SourceParams = {
  readonly source: string;
};

const literalItemCounts = ({ source }: SourceParams): ReadonlyArray<number> => {
  const counts: number[] = [];
  let at = source.indexOf(ITEMS_OPENING);
  while (at !== -1) {
    const open = at + ITEMS_OPENING.length - 1;
    const close = closingBracket({ source, from: open });
    const body = source.slice(open + 1, close);
    at = source.indexOf(ITEMS_OPENING, close);
    if (body.includes('...')) {
      continue;
    }
    counts.push(body.split(/kind:\s*'item'/).length - 1);
  }
  return counts;
};

const singleItemMenus = (): ReadonlyArray<string> =>
  SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root)))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .filter((path) =>
      literalItemCounts({ source: readFileSync(join(SRC, path), 'utf8') }).some(
        (count) => count === 1,
      ),
    );

describe('a menu of one item', () => {
  it('is found in a literal items array', () => {
    const source = `<OverflowMenu entries={[{ kind: 'item', key: 'a', label: 'A', onSelect }]} />`;
    expect(literalItemCounts({ source })).toEqual([1]);
  });

  it('counts two items and skips an array that spreads other items', () => {
    const two = `<OverflowMenu entries={[{ kind: 'item', key: 'a' }, { kind: 'item', key: 'b' }]} />`;
    const spread = `<OverflowMenu entries={[...more, { kind: 'item', key: 'a' }]} />`;
    expect(literalItemCounts({ source: two })).toEqual([2]);
    expect(literalItemCounts({ source: spread })).toEqual([]);
  });

  it('is written nowhere in the app', () => {
    expect(singleItemMenus()).toEqual([]);
  });
});

describe('object menus come from the action registry', () => {
  it('builds no menu by hand outside the registry, except the listed non-object menus', () => {
    expect(offenders().filter((path) => ALLOWED[path] === undefined)).toEqual([]);
  });

  it('keeps the allowlist shrinking: every entry still builds a menu by hand', () => {
    const found = new Set(offenders());
    expect(Object.keys(ALLOWED).filter((path) => !found.has(path))).toEqual([]);
  });
});

describe('a menu role outside the menu primitives', () => {
  it('is found on a popover or a row that builds a menu by hand', () => {
    const fixtures = [
      `<AnchoredPopover dropdown={dropdown} role="menu" ariaLabel="Group tasks by">`,
      `<Popover role="menu" ariaLabel="Session actions">`,
      `<button type="button" role="menuitem" onClick={pick}>`,
      `<button type="button" role='menuitemradio' aria-checked={isChecked}>`,
      `<button role="menuitemcheckbox" aria-checked={isOn}>`,
      `<AnchoredPopover role={view === 'menu' ? 'menu' : 'dialog'}>`,
    ];
    expect(fixtures.filter((source) => !HAND_BUILT_MENU_ROLE.test(source))).toEqual([]);
  });

  it('leaves selectors, other roles and the registry list alone', () => {
    const fixtures = [
      `querySelector<HTMLElement>('[role="menuitem"]')`,
      `const OVERLAYS = ['[role="menu"]', '[role="dialog"]'];`,
      `<AnchoredPopover dropdown={dropdown} role="dialog" ariaLabel="Assignee">`,
      `<AnchoredPopover role={view === 'menu' ? undefined : 'dialog'}>`,
      `<div role="group" aria-label="Show files">`,
      `<AppMenuList label="History" entries={entries} onClose={close} />`,
    ];
    expect(fixtures.filter((source) => HAND_BUILT_MENU_ROLE.test(source))).toEqual([]);
  });

  it('is written nowhere in the app: every menu renders through the registry list', () => {
    expect(roleOffenders()).toEqual([]);
  });
});
