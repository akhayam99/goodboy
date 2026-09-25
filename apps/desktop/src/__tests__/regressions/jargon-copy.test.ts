import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { LENS_LABEL } from '../../features/session/lens-labels';
import { AGENT_KIND_META, ROLE_LABEL } from '../../features/session/agent-kind';
import {
  ACTIVITY_CATEGORY_LABEL,
  ACTIVITY_PRESET_LABEL,
} from '../../features/session/timeline/activityFilter';
import { ROW_NODE_LABEL } from '../../features/workTreeModel/rowStateCopy';
import { GLOSSARY } from '../../features/session/glossary';
import baseline from './jargon-copy.baseline.json';

const SRC_ROOT = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', join('app', 'components'), join('shared', 'components')];
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  '__tests__',
  'testing',
  'MockScene',
]);

const JARGON =
  /(?<![\w-])(clusters?|lens(?:es)?|(?:un)?mount(?:s|ed|ing)?|spawn(?:s|ed|ing)?|studios?|handoffs?|materiali[sz](?:e|es|ed|ing))(?![\w-])/i;

const COPY_PROPS: ReadonlySet<string> = new Set([
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
  'tooltip',
  'content',
  'detail',
  'message',
  'eyebrow',
]);

const NON_COPY_ATTRIBUTES: ReadonlySet<string> = new Set(['className', 'data-testid', 'key', 'id']);

type BaselineEntry = {
  readonly count: number;
  readonly reason: string;
};

const BASELINE: Readonly<Record<string, BaselineEntry>> = baseline;

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

const jargonLines = ({ path }: { readonly path: string }): ReadonlyArray<string> => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Array<string> = [];
  const visit = (node: ts.Node) => {
    const text = literalText({ node });
    if (text !== null && isCopy({ node, text }) && JARGON.test(text)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${line + 1}: ${text.trim().replace(/\s+/g, ' ').slice(0, 100)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

const scan = (): Readonly<Record<string, ReadonlyArray<string>>> =>
  Object.fromEntries(
    SCANNED_ROOTS.flatMap((root) => walk({ directory: join(SRC_ROOT, root) }))
      .map(
        (path) => [relative(SRC_ROOT, path).split(sep).join('/'), jargonLines({ path })] as const,
      )
      .filter(([, lines]) => lines.length > 0),
  );

const NAMED_COPY: Readonly<Record<string, ReadonlyArray<string>>> = {
  LENS_LABEL: Object.values(LENS_LABEL),
  ROLE_LABEL: Object.values(ROLE_LABEL),
  AGENT_KIND_META: Object.values(AGENT_KIND_META).flatMap((meta) => [meta.label, meta.hint]),
  ACTIVITY_CATEGORY_LABEL: Object.values(ACTIVITY_CATEGORY_LABEL),
  ACTIVITY_PRESET_LABEL: Object.values(ACTIVITY_PRESET_LABEL),
  ROW_NODE_LABEL: Object.values(ROW_NODE_LABEL),
  GLOSSARY: Object.values(GLOSSARY).flatMap((entry) => [entry.term, entry.definition]),
};

describe('on-screen copy says no internal word', () => {
  const found = scan();

  it('keeps every named copy map free of internal words', () => {
    const offenders = Object.entries(NAMED_COPY).flatMap(([map, values]) =>
      values.filter((value) => JARGON.test(value)).map((value) => `${map}: ${value}`),
    );

    expect(offenders).toEqual([]);
  });

  it('adds no internal word to rendered copy outside the baseline', () => {
    const offenders = Object.entries(found).flatMap(([path, lines]) => {
      const allowed = BASELINE[path]?.count ?? 0;
      return lines.length > allowed ? lines.map((line) => `${path}:${line}`) : [];
    });

    expect(offenders).toEqual([]);
  });

  it('shrinks the baseline as soon as an exception goes away', () => {
    const stale = Object.entries(BASELINE).flatMap(([path, entry]) => {
      const count = found[path]?.length ?? 0;
      return count < entry.count ? [`${path}: baseline ${entry.count}, found ${count}`] : [];
    });

    expect(stale).toEqual([]);
  });
});
