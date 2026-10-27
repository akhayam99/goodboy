import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

export const RULE_FIXES = {
  'retired-name': 'write the name the app uses today, see apps/desktop/src/shared/utils/names.ts',
  dash: 'write a comma, a colon or a new sentence, never an em dash or an en dash',
};

export const RULE_IDS = Object.keys(RULE_FIXES);

const SCANNED = ['App.tsx', 'site.ts', 'sections', 'components', 'pages', 'hooks'];
const SKIPPED_DIRECTORIES = new Set(['node_modules']);
const SKIPPED_ATTRIBUTES = new Set(['className', 'key', 'id', 'href', 'src', 'srcSet', 'type']);
const JSON_COPY_KEYS = new Set(['title', 'text', 'lead', 'label', 'also']);
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, 'g');
const PATTERN_LITERAL = /pattern:\s*(\/(?:\\.|[^/\\\n])+\/[a-z]*),/g;
const RETIRED_ID = /\bid:\s*'/g;

export const retiredPatternsFrom = ({ source }) => {
  const patterns = [...source.matchAll(PATTERN_LITERAL)].map(([, literal]) => {
    const end = literal.lastIndexOf('/');
    return new RegExp(literal.slice(1, end), literal.slice(end + 1));
  });
  const ids = [...source.matchAll(RETIRED_ID)].length;
  if (patterns.length === 0 || patterns.length !== ids) {
    throw new Error(
      `read ${patterns.length} patterns for ${ids} retired names, the list changed shape`,
    );
  }
  return patterns;
};

const walk = ({ path }) => {
  if (!existsSync(path)) {
    return [];
  }
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  return readdirSync(path).flatMap((entry) =>
    SKIPPED_DIRECTORIES.has(entry) ? [] : walk({ path: join(path, entry) }),
  );
};

const isSource = ({ path }) => /\.tsx?$/.test(path) && !/\.(?:test|d)\.tsx?$/.test(path);

const literalText = ({ node }) => {
  if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
  }
  return null;
};

const isSkipped = ({ node }) => {
  const { parent } = node;
  if (ts.isLiteralTypeNode(parent)) {
    return true;
  }
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
    return true;
  }
  if (ts.isJsxAttribute(parent)) {
    return SKIPPED_ATTRIBUTES.has(parent.name.getText());
  }
  return ts.isPropertyAssignment(parent) && SKIPPED_ATTRIBUTES.has(parent.name.getText());
};

const stringsOfSource = ({ path }) => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found = [];
  const visit = (node) => {
    const text = literalText({ node });
    if (text !== null && text.trim() !== '' && !isSkipped({ node })) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      found.push({ line: line + 1, text: text.trim().replace(/\s+/g, ' ') });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

const stringsOfJson = ({ path }) => {
  const found = [];
  const visit = (value, key) => {
    if (typeof value === 'string') {
      if (JSON_COPY_KEYS.has(key)) {
        found.push({ line: 0, text: value });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }
    if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([name, item]) => visit(item, name));
    }
  };
  visit(JSON.parse(readFileSync(path, 'utf8')));
  return found;
};

export const siteStrings = ({ srcRoot }) =>
  SCANNED.flatMap((entry) => walk({ path: join(srcRoot, entry) }))
    .filter((path) => isSource({ path }) || path.endsWith('.json'))
    .map((path) => ({
      file: `website/${relative(join(srcRoot, '..'), path).split(sep).join('/')}`,
      strings: path.endsWith('.json') ? stringsOfJson({ path }) : stringsOfSource({ path }),
    }));

const dashesIn = ({ text }) => text.match(DASHES)?.length ?? 0;

const isRetired = ({ text, patterns }) => patterns.some((pattern) => pattern.test(text));

export const measureSiteCopy = ({ srcRoot, patterns }) =>
  Object.fromEntries(
    siteStrings({ srcRoot }).map(({ file, strings }) => [
      file,
      {
        'retired-name': strings.filter(({ text }) => isRetired({ text, patterns })).length,
        dash: strings.reduce((sum, { text }) => sum + dashesIn({ text }), 0),
      },
    ]),
  );

export const locationsOf = ({ srcRoot, patterns, id }) =>
  siteStrings({ srcRoot }).flatMap(({ file, strings }) =>
    strings
      .filter(({ text }) =>
        id === 'dash' ? dashesIn({ text }) > 0 : isRetired({ text, patterns }),
      )
      .map(({ line, text }) => `${file}:${line}: ${text.slice(0, 90)}`),
  );

export const growthLines = ({ measured, baseline }) =>
  Object.entries(measured).flatMap(([file, counts]) =>
    RULE_IDS.flatMap((id) => {
      const allowed = baseline[id]?.[file] ?? 0;
      return counts[id] > allowed
        ? [`  - ${id} ${file}: ${counts[id]} (baseline ${allowed}), ${RULE_FIXES[id]}`]
        : [];
    }),
  );

export const staleLines = ({ measured, baseline }) =>
  RULE_IDS.flatMap((id) =>
    Object.entries(baseline[id] ?? {}).flatMap(([file, allowed]) => {
      const count = measured[file]?.[id] ?? 0;
      return count < allowed
        ? [`  - ${id} ${file}: ${count} (baseline ${allowed}), lower the baseline to ${count}`]
        : [];
    }),
  );

export const baselineOf = ({ measured }) =>
  Object.fromEntries(
    RULE_IDS.map((id) => [
      id,
      Object.fromEntries(
        Object.entries(measured)
          .filter(([, counts]) => counts[id] > 0)
          .map(([file, counts]) => [file, counts[id]])
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    ]).filter(([, byFile]) => Object.keys(byFile).length > 0),
  );
