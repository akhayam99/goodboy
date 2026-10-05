import type { FileDiff } from '@goodboy/types';
import { fileKindOf, type FileKind } from './fileStatus';

type TreeFolderRow = {
  readonly kind: 'folder';
  readonly id: string;
  readonly parentId: string | null;
  readonly label: string;
  readonly depth: number;
  readonly fileCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly paths: ReadonlyArray<string>;
};

type TreeFileRow = {
  readonly kind: 'file';
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly depth: number;
  readonly file: FileDiff;
  readonly fileKind: FileKind;
  readonly fromPath: string | null;
};

export type TreeRow = TreeFolderRow | TreeFileRow;

export type ChangeTree = {
  readonly rows: ReadonlyArray<TreeRow>;
  readonly files: ReadonlyArray<FileDiff>;
};

type Node = {
  readonly name: string;
  readonly dirs: Map<string, Node>;
  readonly files: FileDiff[];
};

const newNode = (name: string): Node => ({ name, dirs: new Map(), files: [] });

const compare = (left: string, right: string): number => left.localeCompare(right);

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

const insert = (root: Node, file: FileDiff): void => {
  const parts = file.path.split('/');
  let node = root;
  for (const part of parts.slice(0, -1)) {
    const next = node.dirs.get(part) ?? newNode(part);
    node.dirs.set(part, next);
    node = next;
  }
  node.files.push(file);
};

const fromPathOf = (file: FileDiff): string | null =>
  file.status === 'renamed' && file.oldPath !== undefined && file.oldPath !== file.path
    ? file.oldPath
    : null;

const fileRow = (file: FileDiff, parentId: string | null, depth: number): TreeFileRow => ({
  kind: 'file',
  id: file.path,
  parentId,
  name: nameOf(file.path),
  depth,
  file,
  fileKind: fileKindOf(file.path),
  fromPath: fromPathOf(file),
});

const emitFolder = (
  node: Node,
  parentPath: string | null,
  depth: number,
  rows: TreeRow[],
  ordered: FileDiff[],
): TreeFolderRow => {
  let current = node;
  let label = node.name;
  while (current.files.length === 0 && current.dirs.size === 1) {
    const [only] = current.dirs.values();
    if (only === undefined) {
      break;
    }
    current = only;
    label = `${label}/${only.name}`;
  }
  const path = parentPath === null ? label : `${parentPath}/${label}`;
  const index = rows.length;
  const placeholder: TreeFolderRow = {
    kind: 'folder',
    id: path,
    parentId: parentPath,
    label,
    depth,
    fileCount: 0,
    additions: 0,
    deletions: 0,
    paths: [],
  };
  rows.push(placeholder);
  const paths: string[] = [];
  let additions = 0;
  let deletions = 0;
  for (const sub of [...current.dirs.values()].sort((a, b) => compare(a.name, b.name))) {
    const child = emitFolder(sub, path, depth + 1, rows, ordered);
    additions += child.additions;
    deletions += child.deletions;
    paths.push(...child.paths);
  }
  for (const file of [...current.files].sort((a, b) => compare(nameOf(a.path), nameOf(b.path)))) {
    rows.push(fileRow(file, path, depth + 1));
    ordered.push(file);
    additions += file.additions;
    deletions += file.deletions;
    paths.push(file.path);
  }
  const done: TreeFolderRow = {
    ...placeholder,
    fileCount: paths.length,
    additions,
    deletions,
    paths,
  };
  rows[index] = done;
  return done;
};

export const buildChangeTree = ({
  files,
}: {
  readonly files: ReadonlyArray<FileDiff>;
}): ChangeTree => {
  const root = newNode('');
  for (const file of files) {
    insert(root, file);
  }
  const rows: TreeRow[] = [];
  const ordered: FileDiff[] = [];
  for (const sub of [...root.dirs.values()].sort((a, b) => compare(a.name, b.name))) {
    emitFolder(sub, null, 0, rows, ordered);
  }
  for (const file of [...root.files].sort((a, b) => compare(a.path, b.path))) {
    rows.push(fileRow(file, null, 0));
    ordered.push(file);
  }
  return { rows, files: ordered };
};

export const visibleRows = ({
  rows,
  collapsed,
}: {
  readonly rows: ReadonlyArray<TreeRow>;
  readonly collapsed: ReadonlySet<string>;
}): ReadonlyArray<TreeRow> => {
  if (collapsed.size === 0) {
    return rows;
  }
  const out: TreeRow[] = [];
  let hiddenBelow: number | null = null;
  for (const row of rows) {
    if (hiddenBelow !== null && row.depth > hiddenBelow) {
      continue;
    }
    hiddenBelow = null;
    out.push(row);
    if (row.kind === 'folder' && collapsed.has(row.id)) {
      hiddenBelow = row.depth;
    }
  }
  return out;
};

export const ancestorIds = ({
  rows,
  path,
}: {
  readonly rows: ReadonlyArray<TreeRow>;
  readonly path: string;
}): ReadonlyArray<string> => {
  const parents = new Map(rows.map((row) => [row.id, row.parentId]));
  const out: string[] = [];
  let next = parents.get(path) ?? null;
  while (next !== null) {
    out.push(next);
    next = parents.get(next) ?? null;
  }
  return out;
};

const BIG_CHANGE_FILES = 300;
const BIG_FOLDER_FILES = 50;

export const defaultCollapsed = ({ tree }: { readonly tree: ChangeTree }): ReadonlySet<string> => {
  if (tree.files.length <= BIG_CHANGE_FILES) {
    return new Set();
  }
  const big = tree.rows.filter((row) => row.kind === 'folder' && row.fileCount > BIG_FOLDER_FILES);
  const parentsOfBig = new Set(big.map((row) => row.parentId));
  return new Set(big.filter((row) => !parentsOfBig.has(row.id)).map((row) => row.id));
};
