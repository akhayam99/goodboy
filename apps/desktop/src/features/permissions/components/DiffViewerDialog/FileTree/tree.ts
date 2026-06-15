import type { FileDiff } from '@goodboy/types';

export type TreeNode =
  | {
      kind: 'dir';
      name: string;
      children: TreeNode[];
      additions: number;
      deletions: number;
    }
  | { kind: 'file'; name: string; file: FileDiff; index: number };

export const buildTree = (files: ReadonlyArray<FileDiff>): TreeNode => {
  const root: TreeNode = { kind: 'dir', name: '', children: [], additions: 0, deletions: 0 };
  files.forEach((f, idx) => {
    const parts = f.path.split('/');
    const fileName = parts.pop() ?? f.path;
    let cur = root as Extract<TreeNode, { kind: 'dir' }>;
    for (const part of parts) {
      let next = cur.children.find(
        (c): c is Extract<TreeNode, { kind: 'dir' }> => c.kind === 'dir' && c.name === part,
      );
      if (!next) {
        next = { kind: 'dir', name: part, children: [], additions: 0, deletions: 0 };
        cur.children.push(next);
      }
      cur = next;
    }
    cur.children.push({ kind: 'file', name: fileName, file: f, index: idx });
  });

  const collapse = (node: TreeNode) => {
    if (node.kind !== 'dir') {
      return;
    }
    while (node.children.length === 1) {
      const only = node.children[0];
      if (!only || only.kind !== 'dir') {
        break;
      }
      node.name = node.name ? `${node.name}/${only.name}` : only.name;
      node.children = only.children;
    }
    for (const c of node.children) collapse(c);
  };
  for (const c of root.children) collapse(c);

  const aggregate = (node: TreeNode): { a: number; d: number } => {
    if (node.kind === 'file') {
      return { a: node.file.additions, d: node.file.deletions };
    }
    let a = 0;
    let d = 0;
    for (const c of node.children) {
      const r = aggregate(c);
      a += r.a;
      d += r.d;
    }
    node.additions = a;
    node.deletions = d;
    return { a, d };
  };
  aggregate(root);

  const sort = (node: TreeNode) => {
    if (node.kind !== 'dir') {
      return;
    }
    node.children.sort((x, y) => {
      if (x.kind !== y.kind) {
        return x.kind === 'dir' ? -1 : 1;
      }
      return x.name.localeCompare(y.name);
    });
    for (const c of node.children) sort(c);
  };
  sort(root);

  return root;
};
