import type { FileDiff } from '@goodboy/types';
import { fileKindOf, isGeneratedPath, type FileKind } from './fileStatus';

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
  readonly dir: string | null;
};

export type TreeRow = TreeFolderRow | TreeFileRow;

export type TreeGroup = 'folders' | 'kind';

const GENERATED_GROUP_ID = 'group:generated';

const FOLDER_ID_PREFIX = 'dir:';

const folderIdOf = (path: string): string => `${FOLDER_ID_PREFIX}${path}`;

const KIND_GROUPS: ReadonlyArray<{ readonly kind: FileKind; readonly label: string }> = [
  { kind: 'source', label: 'Source' },
  { kind: 'test', label: 'Tests' },
  { kind: 'config', label: 'Config' },
  { kind: 'docs', label: 'Docs' },
];

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

const dirOf = (path: string): string | null => {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? null : path.slice(0, slash);
};

const fileRow = (
  file: FileDiff,
  parentId: string | null,
  depth: number,
  flat = false,
): TreeFileRow => ({
  kind: 'file',
  id: file.path,
  parentId,
  name: nameOf(file.path),
  depth,
  file,
  fileKind: fileKindOf(file.path),
  fromPath: fromPathOf(file),
  dir: flat ? dirOf(file.path) : null,
});

const emitFlatGroup = ({
  id,
  label,
  files,
  rows,
  ordered,
}: {
  readonly id: string;
  readonly label: string;
  readonly files: ReadonlyArray<FileDiff>;
  readonly rows: TreeRow[];
  readonly ordered: FileDiff[];
}): void => {
  if (files.length === 0) {
    return;
  }
  const sorted = [...files].sort((a, b) => compare(a.path, b.path));
  rows.push({
    kind: 'folder',
    id,
    parentId: null,
    label,
    depth: 0,
    fileCount: sorted.length,
    additions: sorted.reduce((sum, file) => sum + file.additions, 0),
    deletions: sorted.reduce((sum, file) => sum + file.deletions, 0),
    paths: sorted.map((file) => file.path),
  });
  for (const file of sorted) {
    rows.push(fileRow(file, id, 1, true));
    ordered.push(file);
  }
};

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
    id: folderIdOf(path),
    parentId: parentPath === null ? null : folderIdOf(parentPath),
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
    rows.push(fileRow(file, folderIdOf(path), depth + 1));
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

const buildFolderRows = (
  files: ReadonlyArray<FileDiff>,
  rows: TreeRow[],
  ordered: FileDiff[],
): void => {
  const root = newNode('');
  for (const file of files) {
    insert(root, file);
  }
  for (const sub of [...root.dirs.values()].sort((a, b) => compare(a.name, b.name))) {
    emitFolder(sub, null, 0, rows, ordered);
  }
  for (const file of [...root.files].sort((a, b) => compare(a.path, b.path))) {
    rows.push(fileRow(file, null, 0));
    ordered.push(file);
  }
};

export const buildChangeTree = ({
  files,
  group = 'folders',
}: {
  readonly files: ReadonlyArray<FileDiff>;
  readonly group?: TreeGroup;
}): ChangeTree => {
  const rows: TreeRow[] = [];
  const ordered: FileDiff[] = [];
  const generated = files.filter((file) => isGeneratedPath(file.path));
  const authored = files.filter((file) => !isGeneratedPath(file.path));
  if (group === 'folders') {
    buildFolderRows(authored, rows, ordered);
  }
  for (const { kind, label } of group === 'kind' ? KIND_GROUPS : []) {
    emitFlatGroup({
      id: `group:${kind}`,
      label,
      files: authored.filter((file) => fileKindOf(file.path) === kind),
      rows,
      ordered,
    });
  }
  emitFlatGroup({ id: GENERATED_GROUP_ID, label: 'Generated', files: generated, rows, ordered });
  return { rows, files: ordered };
};

export const orderLikeTree = ({
  files,
}: {
  readonly files: ReadonlyArray<FileDiff>;
}): ReadonlyArray<FileDiff> => buildChangeTree({ files }).files;

const subsequenceScore = (haystack: string, needle: string): number | null => {
  let from = 0;
  let gaps = 0;
  for (const char of needle) {
    const at = haystack.indexOf(char, from);
    if (at < 0) {
      return null;
    }
    gaps += at - from;
    from = at + 1;
  }
  return gaps;
};

export const filterFiles = ({
  files,
  query,
}: {
  readonly files: ReadonlyArray<FileDiff>;
  readonly query: string;
}): ReadonlyArray<FileDiff> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return files;
  }
  return files.filter((file) => subsequenceScore(file.path.toLowerCase(), needle) !== null);
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

type FolderPathParams = {
  readonly id: string;
};

type FoldedAncestorParams = {
  readonly rows: ReadonlyArray<TreeRow>;
  readonly collapsed: ReadonlySet<string>;
  readonly path: string;
};

export const folderPathOf = ({ id }: FolderPathParams): string | null =>
  id.startsWith(FOLDER_ID_PREFIX) ? id.slice(FOLDER_ID_PREFIX.length) : null;

export const foldedAncestorOf = ({ rows, collapsed, path }: FoldedAncestorParams): string | null =>
  ancestorIds({ rows, path })
    .filter((id) => collapsed.has(id))
    .at(-1) ?? null;

const BIG_CHANGE_FILES = 300;
const BIG_FOLDER_FILES = 50;

export const defaultCollapsed = ({ tree }: { readonly tree: ChangeTree }): ReadonlySet<string> => {
  const closed = new Set<string>();
  if (tree.rows.some((row) => row.id === GENERATED_GROUP_ID)) {
    closed.add(GENERATED_GROUP_ID);
  }
  if (tree.files.length <= BIG_CHANGE_FILES) {
    return closed;
  }
  const big = tree.rows.filter((row) => row.kind === 'folder' && row.fileCount > BIG_FOLDER_FILES);
  const parentsOfBig = new Set(big.map((row) => row.parentId));
  for (const row of big) {
    if (!parentsOfBig.has(row.id)) {
      closed.add(row.id);
    }
  }
  return closed;
};
