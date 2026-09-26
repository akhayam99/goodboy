import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_ROOTS = ['apps/desktop/src', 'packages/ui/src'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '__tests__', 'testing']);
const IS_DRY_RUN = process.argv.includes('--dry-run');

const WEIGHTS = new Set([
  'font-thin',
  'font-light',
  'font-normal',
  'font-medium',
  'font-semibold',
  'font-bold',
]);

const isLeading = (token) => token.startsWith('leading-');

const leadingOf = (tokens) => tokens.filter(isLeading);

const weightsOf = (tokens) => tokens.filter((token) => WEIGHTS.has(token));

const leadingIsAbsentOr = (tokens, allowed) =>
  leadingOf(tokens).every((token) => allowed.includes(token)) && leadingOf(tokens).length <= 1;

const RULES = [
  {
    role: 'text-eyebrow',
    needs: ['text-2xs', 'font-semibold', 'uppercase', 'tracking-eyebrow'],
    drops: [],
    when: (tokens) => leadingOf(tokens).length === 0,
  },
  {
    role: 'text-display',
    needs: ['text-2xl', 'font-semibold'],
    drops: ['tracking-tight'],
    when: (tokens) => leadingIsAbsentOr(tokens, ['leading-8']),
  },
  {
    role: 'text-title',
    needs: ['text-lg', 'font-semibold'],
    drops: ['tracking-tight'],
    when: (tokens) => leadingIsAbsentOr(tokens, ['leading-6']),
  },
  {
    role: 'text-heading',
    needs: ['text-sm', 'font-semibold'],
    drops: [],
    when: (tokens) => leadingIsAbsentOr(tokens, ['leading-5']),
  },
  {
    role: 'text-row',
    needs: ['text-sm', 'font-medium'],
    drops: [],
    when: (tokens) => leadingIsAbsentOr(tokens, ['leading-5']),
  },
  {
    role: 'text-prose',
    needs: ['text-sm', 'leading-relaxed'],
    drops: [],
    when: (tokens) => weightsOf(tokens).length === 0,
  },
  {
    role: 'text-body',
    needs: ['text-sm'],
    drops: [],
    when: (tokens) => weightsOf(tokens).length === 0 && leadingIsAbsentOr(tokens, ['leading-5']),
  },
  {
    role: 'text-code',
    needs: ['font-mono', 'text-xs'],
    drops: [],
    when: (tokens) => leadingOf(tokens).length === 0 && weightsOf(tokens).length === 0,
  },
  {
    role: 'text-label',
    needs: ['text-xs'],
    drops: [],
    when: (tokens) => leadingIsAbsentOr(tokens, ['leading-4']),
  },
  {
    role: 'text-secondary',
    needs: ['text-2xs'],
    drops: [],
    when: (tokens) => leadingIsAbsentOr(tokens, ['leading-4']),
  },
  {
    role: 'text-meta',
    needs: ['text-3xs'],
    drops: ['tabular-nums', 'tabular'],
    when: (tokens) => leadingOf(tokens).length === 0,
  },
];

const LEADING_BY_ROLE = {
  'text-display': ['leading-8'],
  'text-title': ['leading-6'],
  'text-heading': ['leading-5'],
  'text-row': ['leading-5'],
  'text-prose': ['leading-relaxed'],
  'text-body': ['leading-5'],
  'text-label': ['leading-4'],
  'text-secondary': ['leading-4'],
};

const rewriteTokens = (tokens) => {
  for (const rule of RULES) {
    if (!rule.needs.every((token) => tokens.includes(token)) || !rule.when(tokens)) {
      continue;
    }
    const removed = new Set([...rule.needs, ...rule.drops, ...(LEADING_BY_ROLE[rule.role] ?? [])]);
    const first = tokens.findIndex((token) => removed.has(token));
    return tokens.flatMap((token, index) => {
      if (index === first) {
        return [rule.role];
      }
      return removed.has(token) ? [] : [token];
    });
  }
  return tokens;
};

const CLASS_TOKEN = /^[!\w:[\]/.%-]+$/;

const rewriteClassText = (text) => {
  if (!/(^|\s)text-(?:3xs|2xs|xs|sm|lg|2xl)(\s|$)/.test(text)) {
    return text;
  }
  const leading = /^\s*/.exec(text)[0];
  const trailing = /\s*$/.exec(text)[0];
  const body = text.slice(leading.length, text.length - trailing.length);
  if (body.length === 0 || /\n/.test(body)) {
    return text;
  }
  const tokens = body.split(/ +/);
  if (!tokens.every((token) => CLASS_TOKEN.test(token))) {
    return text;
  }
  const next = rewriteTokens(tokens);
  if (next === tokens) {
    return text;
  }
  return `${leading}${next.join(' ')}${trailing}`;
};

const INNER_BOUNDS = {
  [ts.SyntaxKind.StringLiteral]: [1, 1],
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: [1, 1],
  [ts.SyntaxKind.TemplateHead]: [1, 2],
  [ts.SyntaxKind.TemplateMiddle]: [1, 2],
  [ts.SyntaxKind.TemplateTail]: [1, 1],
};

const rewriteSource = (path, source) => {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const edits = [];
  const visit = (node) => {
    const bounds = INNER_BOUNDS[node.kind];
    if (bounds !== undefined) {
      const start = node.getStart(file) + bounds[0];
      const end = node.end - bounds[1];
      const text = source.slice(start, end);
      const next = rewriteClassText(text);
      if (next !== text) {
        edits.push({ start, end, next });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return edits
    .sort((left, right) => right.start - left.start)
    .reduce((acc, edit) => acc.slice(0, edit.start) + edit.next + acc.slice(edit.end), source);
};

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    const isSource =
      /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith('.d.ts');
    return isSource ? [full] : [];
  });

const files = SOURCE_ROOTS.flatMap((root) => walk(join(ROOT_DIRECTORY, root)));
const changed = files.filter((path) => {
  const source = readFileSync(path, 'utf8');
  const next = rewriteSource(path, source);
  if (next === source) {
    return false;
  }
  if (!IS_DRY_RUN) {
    writeFileSync(path, next);
  }
  return true;
});

for (const path of changed) {
  console.log(relative(ROOT_DIRECTORY, path).split(sep).join('/'));
}
console.log(`${changed.length} files ${IS_DRY_RUN ? 'would change' : 'changed'}`);
