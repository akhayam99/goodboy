import ts from 'typescript';
import { collect, lineOf, parseFile, visit } from './parse.mjs';

const namedBindingsOf = ({ named }) => {
  if (named === undefined) {
    return [];
  }
  return ts.isNamespaceImport(named) ? [named.name] : named.elements.map((element) => element.name);
};

const importedNames = ({ declaration }) => {
  const clause = declaration.importClause;
  if (clause === undefined) {
    return [];
  }
  const defaultName = clause.name === undefined ? [] : [clause.name];
  return [...defaultName, ...namedBindingsOf({ named: clause.namedBindings })];
};

const isInsideImport = ({ node }) => {
  let current = node.parent;
  while (current !== undefined) {
    if (ts.isImportDeclaration(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const referencedOutsideImports = ({ file }) => {
  const used = new Set();
  visit({
    node: parseFile({ file }),
    onNode: (node) => {
      if (ts.isIdentifier(node) && !isInsideImport({ node })) {
        used.add(node.text);
      }
    },
  });
  return used;
};

const unusedImportNames = ({ file }) => {
  const used = referencedOutsideImports({ file });
  return collect({
    file,
    pick: (node) =>
      ts.isImportDeclaration(node)
        ? importedNames({ declaration: node })
            .filter((name) => !used.has(name.text))
            .map((name) => ({ name: name.text, line: lineOf({ node: name }) }))
        : undefined,
  }).flat();
};

export const unusedImportLines = ({ file }) =>
  unusedImportNames({ file }).map((entry) => entry.line);
