import ts from 'typescript';
import { COPY_PROPS } from './copyProps';

const NON_COPY_ATTRIBUTES: ReadonlySet<string> = new Set(['className', 'data-testid', 'key', 'id']);

export type CopyString = {
  readonly path: string;
  readonly line: number;
  readonly prop: string | null;
  readonly text: string;
  readonly hasLeadingExpression?: boolean;
  readonly isConditionalBranch?: boolean;
  readonly element?: string;
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
  let current = node;
  while (
    (ts.isConditionalExpression(current.parent) && current.parent.condition !== current) ||
    ts.isParenthesizedExpression(current.parent)
  ) {
    current = current.parent;
  }
  const { parent } = current;
  if (ts.isJsxAttribute(parent)) {
    return parent.name.getText();
  }
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText();
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
    return parent.name.getText().replace(/['"]/g, '');
  }
  return null;
};

const isConditionalBranch = ({ node }: NodeParams): boolean => {
  let current = node;
  while (ts.isParenthesizedExpression(current.parent)) {
    current = current.parent;
  }
  return (
    ts.isConditionalExpression(current.parent) &&
    current.parent.condition !== current &&
    copyPropOf({ node }) !== null
  );
};

const elementOf = ({ node }: NodeParams): string | undefined => {
  let current = node.parent;
  while (!ts.isSourceFile(current)) {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
      return current.tagName.getText();
    }
    if (ts.isJsxElement(current)) {
      return current.openingElement.tagName.getText();
    }
    current = current.parent;
  }
  return undefined;
};

const isImportPath = ({ node }: NodeParams): boolean =>
  ts.isImportDeclaration(node.parent) ||
  ts.isExportDeclaration(node.parent) ||
  ts.isExternalModuleReference(node.parent);

type CopyParams = NodeParams & { readonly text: string };

const isCopy = ({ node, text }: CopyParams): boolean => {
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
  const visible = ts.isTemplateExpression(node)
    ? [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('')
    : text.trim();
  return /\s/.test(visible) || (prop !== null && COPY_PROPS.has(prop));
};

type Params = {
  readonly path: string;
  readonly text: string;
};

export const scanCopySource = ({ path, text }: Params): ReadonlyArray<CopyString> => {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Array<CopyString> = [];
  const visit = ({ node }: NodeParams) => {
    const text = literalText({ node });
    if (text !== null && isCopy({ node, text })) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      const element = elementOf({ node });
      found.push({
        path,
        ...(element === undefined ? {} : { element }),
        line: line + 1,
        prop: copyPropOf({ node }),
        text: text.trim().replace(/\s+/g, ' '),
        ...(isConditionalBranch({ node }) ? { isConditionalBranch: true } : {}),
        ...(ts.isTemplateExpression(node) && node.head.text.trim() === ''
          ? { hasLeadingExpression: true }
          : {}),
      });
    }
    ts.forEachChild(node, (child) => visit({ node: child }));
  };
  visit({ node: source });
  return found;
};
