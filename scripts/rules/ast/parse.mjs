import ts from 'typescript';

const parsed = new WeakMap();

export const parseFile = ({ file }) => {
  const cached = parsed.get(file);
  if (cached !== undefined) {
    return cached;
  }
  const isTsx = file.path.endsWith('.tsx');
  const source = ts.createSourceFile(
    file.path,
    file.lines.join('\n'),
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  parsed.set(file, source);
  return source;
};

export const visit = ({ node, onNode }) => {
  onNode(node);
  ts.forEachChild(node, (child) => visit({ node: child, onNode }));
};

export const collect = ({ file, pick }) => {
  const hits = [];
  visit({
    node: parseFile({ file }),
    onNode: (node) => {
      const hit = pick(node);
      if (hit !== undefined) {
        hits.push(hit);
      }
    },
  });
  return hits;
};

export const lineOf = ({ node }) =>
  node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
