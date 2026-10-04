import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import ts from 'typescript';

const SRC_ROOT = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', join('app', 'components'), join('shared', 'components')];
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  '__tests__',
  'testing',
  'MockScene',
]);

export const COPY_PROPS: ReadonlySet<string> = new Set([
  'title',
  'label',
  'description',
  'aria-label',
  'ariaLabel',
  'placeholder',
  'actionLabel',
  'busyLabel',
  'confirmLabel',
  'closeLabel',
  'menuLabel',
  'body',
  'hint',
  'help',
  'meta',
  'tooltip',
  'content',
  'detail',
  'message',
  'eyebrow',
]);

const NON_COPY_ATTRIBUTES: ReadonlySet<string> = new Set(['className', 'data-testid', 'key', 'id']);

export type CopyString = {
  readonly path: string;
  readonly line: number;
  readonly prop: string | null;
  readonly text: string;
};

type WalkParams = {
  readonly directory: string;
};

const walk = ({ directory }: WalkParams): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      return walk({ directory: full });
    }
    const isSource =
      /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith('.d.ts');
    return isSource ? [full] : [];
  });
};

type NodeParams = {
  readonly node: ts.Node;
};

const literalText = ({ node }: NodeParams): string | null => {
  if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
  }
  return null;
};

const copyPropOf = ({ node }: NodeParams): string | null => {
  const { parent } = node;
  if (ts.isJsxAttribute(parent)) {
    return parent.name.getText();
  }
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText();
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return parent.name.getText().replace(/['"]/g, '');
  }
  return null;
};

const isImportPath = ({ node }: NodeParams): boolean =>
  ts.isImportDeclaration(node.parent) ||
  ts.isExportDeclaration(node.parent) ||
  ts.isExternalModuleReference(node.parent);

const isCopy = ({ node, text }: NodeParams & { readonly text: string }): boolean => {
  if (isImportPath({ node })) {
    return false;
  }
  const prop = copyPropOf({ node });
  if (prop !== null && NON_COPY_ATTRIBUTES.has(prop)) {
    return false;
  }
  if (ts.isJsxText(node)) {
    return text.trim() !== '';
  }
  return /\s/.test(text.trim()) || (prop !== null && COPY_PROPS.has(prop));
};

type ScanFileParams = {
  readonly path: string;
};

const scanFile = ({ path }: ScanFileParams): ReadonlyArray<CopyString> => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const relativePath = relative(SRC_ROOT, path).split(sep).join('/');
  const found: Array<CopyString> = [];
  const visit = (node: ts.Node) => {
    const text = literalText({ node });
    if (text !== null && isCopy({ node, text })) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push({
        path: relativePath,
        line: line + 1,
        prop: copyPropOf({ node }),
        text: text.trim().replace(/\s+/g, ' '),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

export const scanCopy = (): ReadonlyArray<CopyString> =>
  SCANNED_ROOTS.flatMap((root) => walk({ directory: join(SRC_ROOT, root) })).flatMap((path) =>
    scanFile({ path }),
  );

type DescribeParams = {
  readonly copy: CopyString;
};

export const describeCopy = ({ copy }: DescribeParams): string =>
  `${copy.path}:${copy.line}: ${copy.text.slice(0, 100)}`;
