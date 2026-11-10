import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import ts from 'typescript';
import { DESKTOP_SRC } from './sourceImports';

type PathParams = {
  readonly path: string;
};

type NodeParams = {
  readonly node: ts.Node;
  readonly path: string;
  readonly source: ts.SourceFile;
};

type NameParams = {
  readonly name: string;
  readonly path: string;
  readonly source: ts.SourceFile;
};

type ModuleParams = {
  readonly from: string;
  readonly specifier: string;
};

export type MenuRows = {
  readonly rows: number;
  readonly unresolved: ReadonlyArray<string>;
};

const EXTENSIONS: ReadonlyArray<string> = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

const parse = ({ path }: PathParams): ts.SourceFile =>
  ts.createSourceFile(
    path,
    readFileSync(join(DESKTOP_SRC, path), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

const resolveModule = ({ from, specifier }: ModuleParams): string | null => {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const base = join(dirname(from), specifier).split('\\').join('/');
  const found = EXTENSIONS.map((extension) => `${base}${extension}`).find((candidate) =>
    existsSync(join(DESKTOP_SRC, candidate)),
  );
  return found ?? null;
};

const propertyOf = ({
  literal,
  name,
}: {
  readonly literal: ts.ObjectLiteralExpression;
  readonly name: string;
}): ts.Expression | null => {
  const found = literal.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && property.name.getText() === name,
  );
  return found === undefined ? null : found.initializer;
};

const unwrapped = ({
  node,
}: {
  readonly node: ts.Expression | undefined;
}): ts.Expression | undefined => {
  let current = node;
  while (
    current !== undefined &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
};

const constArrayLength = ({ name, path, source }: NameParams): number | null => {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const initializer = unwrapped({ node: declaration.initializer });
      if (
        declaration.name.getText() === name &&
        initializer !== undefined &&
        ts.isArrayLiteralExpression(initializer)
      ) {
        return initializer.elements.length;
      }
    }
  }
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.getText().includes(name)
    ) {
      const target = resolveModule({ from: path, specifier: statement.moduleSpecifier.text });
      if (target !== null) {
        return constArrayLength({ name, path: target, source: parse({ path: target }) });
      }
    }
  }
  return null;
};

const choicesLength = ({ node, path, source }: NodeParams): number | null => {
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.length;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'map' &&
    ts.isIdentifier(node.expression.expression)
  ) {
    return constArrayLength({ name: node.expression.expression.text, path, source });
  }
  return null;
};

const kindOf = ({ literal }: { readonly literal: ts.ObjectLiteralExpression }): string | null => {
  const kind = propertyOf({ literal, name: 'kind' });
  return kind !== null && ts.isStringLiteral(kind) ? kind.text : null;
};

const isMapCall = ({ node }: { readonly node: ts.Node }): boolean =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  (node.expression.name.text === 'map' || node.expression.name.text === 'flatMap');

const mappingCallOf = ({ node }: { readonly node: ts.Node }): ts.CallExpression | null => {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const parent = current.parent;
      return ts.isCallExpression(parent) && isMapCall({ node: parent }) ? parent : null;
    }
    current = current.parent;
  }
  return null;
};

export const menuRowsOf = ({ path }: PathParams): MenuRows => {
  const source = parse({ path });
  let rows = 0;
  const unresolved: Array<string> = [];
  const lineOf = ({ node }: { readonly node: ts.Node }): number =>
    source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const kind = kindOf({ literal: node });
      if (kind === 'item') {
        const call = mappingCallOf({ node });
        const length =
          call === null || !ts.isPropertyAccessExpression(call.expression)
            ? 1
            : choicesLength({ node: call, path, source });
        if (length === null) {
          unresolved.push(`mapped item at line ${lineOf({ node })}`);
        }
        rows += length ?? 0;
      }
      if (kind === 'radio') {
        const choices = propertyOf({ literal: node, name: 'choices' });
        const length = choices === null ? null : choicesLength({ node: choices, path, source });
        if (length === null) {
          unresolved.push(`radio at line ${lineOf({ node })}`);
        }
        rows += length ?? 0;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { rows, unresolved };
};
