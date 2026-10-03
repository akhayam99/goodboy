import { slugify, withSlugSuffix } from './slugify';

export const BRANCH_PLACEHOLDERS = ['prefix', 'task-id', 'slug', 'user'] as const;

export type BranchPlaceholder = (typeof BRANCH_PLACEHOLDERS)[number];

export type BranchValues = Readonly<Partial<Record<BranchPlaceholder, string>>>;

export const DEFAULT_BRANCH_TEMPLATE = '{prefix}/{task-id}-{slug}';

export const NO_TASK_BRANCH_TEMPLATE = '{prefix}/{slug}';

export const MAX_BRANCH_NAME_LENGTH = 100;

const TASK_ID_MAX_LENGTH = 16;

const USER_MAX_LENGTH = 24;

const LEADING_SEPARATOR = /^[-_/.]/;

const TRAILING_SEPARATOR = /[-_/.]$/;

const PLACEHOLDER = /(\{[a-z-]+\})/;

const WHOLE_PLACEHOLDER = /^\{[a-z-]+\}$/;

const SEPARATORS = new Set(['-', '_', '/', '.']);

type Part =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'token'; readonly name: string };

const isPlaceholder = (name: string): name is BranchPlaceholder =>
  BRANCH_PLACEHOLDERS.some((candidate) => candidate === name);

const partsOf = (template: string): ReadonlyArray<Part> =>
  template
    .split(PLACEHOLDER)
    .filter((piece) => piece !== '')
    .map((piece) =>
      WHOLE_PLACEHOLDER.test(piece)
        ? { kind: 'token', name: piece.slice(1, -1) }
        : { kind: 'text', text: piece },
    );

const tidyBranchName = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && SEPARATORS.has(value.charAt(start))) {
    start += 1;
  }
  while (end > start && SEPARATORS.has(value.charAt(end - 1))) {
    end -= 1;
  }
  const kept: Array<string> = [];
  for (let index = start; index < end; index += 1) {
    const character = value.charAt(index);
    if (character === '/' && kept[kept.length - 1] === '/') {
      continue;
    }
    kept.push(character);
  }
  return kept.join('');
};

const cleanValue = ({
  name,
  raw,
}: {
  readonly name: BranchPlaceholder;
  readonly raw: string;
}): string => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  if (name === 'prefix') {
    return trimmed
      .toLowerCase()
      .split('/')
      .map((segment) => slugify({ input: segment, fallback: '' }))
      .filter((segment) => segment !== '')
      .join('/');
  }
  if (name === 'task-id') {
    return slugify({ input: trimmed, maxLength: TASK_ID_MAX_LENGTH, fallback: '' });
  }
  if (name === 'user') {
    return slugify({ input: trimmed, maxLength: USER_MAX_LENGTH, fallback: '' });
  }
  return slugify({ input: trimmed, fallback: '' });
};

type BuildParams = {
  readonly template: string;
  readonly values: BranchValues;
};

export const unknownBranchPlaceholders = ({
  template,
}: {
  readonly template: string;
}): ReadonlyArray<string> =>
  partsOf(template).flatMap((part) =>
    part.kind === 'token' && !isPlaceholder(part.name) ? [part.name] : [],
  );

export const buildBranchName = ({ template, values }: BuildParams): string => {
  const texts = partsOf(template).map((part) => {
    if (part.kind === 'text') {
      return { text: part.text, isEmptyToken: false };
    }
    if (!isPlaceholder(part.name)) {
      return { text: `{${part.name}}`, isEmptyToken: false };
    }
    const value = cleanValue({ name: part.name, raw: values[part.name] ?? '' });
    return { text: value, isEmptyToken: value === '' };
  });
  const pieces = texts.map((entry) => entry.text);
  texts.forEach((entry, index) => {
    if (!entry.isEmptyToken) {
      return;
    }
    const next = pieces[index + 1];
    if (next !== undefined && LEADING_SEPARATOR.test(next)) {
      pieces[index + 1] = next.slice(1);
      return;
    }
    const previous = pieces[index - 1];
    if (previous !== undefined && TRAILING_SEPARATOR.test(previous)) {
      pieces[index - 1] = previous.slice(0, -1);
    }
  });
  return tidyBranchName(pieces.join('').toLowerCase());
};

export type BranchNameProblem =
  | 'empty'
  | 'whitespace'
  | 'character'
  | 'double-dot'
  | 'at-brace'
  | 'lone-at'
  | 'starts-with-dash'
  | 'slash'
  | 'dot-segment'
  | 'lock-segment'
  | 'trailing-dot'
  | 'too-long';

const FORBIDDEN_CHARACTER = /[~^:?*[\\\u0000-\u001f\u007f]/;

export const branchNameProblem = ({
  name,
}: {
  readonly name: string;
}): BranchNameProblem | null => {
  if (name === '') {
    return 'empty';
  }
  if (/\s/.test(name)) {
    return 'whitespace';
  }
  if (FORBIDDEN_CHARACTER.test(name)) {
    return 'character';
  }
  if (name.includes('..')) {
    return 'double-dot';
  }
  if (name.includes('@{')) {
    return 'at-brace';
  }
  if (name === '@') {
    return 'lone-at';
  }
  if (name.startsWith('-')) {
    return 'starts-with-dash';
  }
  if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) {
    return 'slash';
  }
  const segments = name.split('/');
  if (segments.some((segment) => segment.startsWith('.'))) {
    return 'dot-segment';
  }
  if (segments.some((segment) => segment.endsWith('.lock'))) {
    return 'lock-segment';
  }
  if (name.endsWith('.')) {
    return 'trailing-dot';
  }
  if (name.length > MAX_BRANCH_NAME_LENGTH) {
    return 'too-long';
  }
  return null;
};

export const isValidBranchName = ({ name }: { readonly name: string }): boolean =>
  branchNameProblem({ name }) === null;

type AvailableParams = BuildParams & {
  readonly taken: ReadonlyArray<string>;
  readonly randomSuffix?: () => string;
};

const MAX_ORDINAL = 99;

export const availableBranchName = ({
  template,
  values,
  taken,
  randomSuffix = () => crypto.randomUUID().slice(0, 8),
}: AvailableParams): string => {
  const used = new Set(taken);
  const slug = cleanValue({ name: 'slug', raw: values.slug ?? '' });
  const withSlug = (next: string): string =>
    buildBranchName({ template, values: { ...values, slug: next } });
  const first = withSlug(slug);
  if (!used.has(first)) {
    return first;
  }
  for (let ordinal = 2; ordinal <= MAX_ORDINAL; ordinal += 1) {
    const candidate = withSlug(withSlugSuffix({ base: slug, suffix: String(ordinal) }));
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return withSlug(withSlugSuffix({ base: slug, suffix: randomSuffix() }));
};

export const nextFreeBranchName = ({
  name,
  taken,
  randomSuffix = () => crypto.randomUUID().slice(0, 8),
}: {
  readonly name: string;
  readonly taken: ReadonlyArray<string>;
  readonly randomSuffix?: () => string;
}): string => {
  const used = new Set(taken);
  if (!used.has(name)) {
    return name;
  }
  for (let ordinal = 2; ordinal <= MAX_ORDINAL; ordinal += 1) {
    const candidate = `${name}-${ordinal}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `${name}-${randomSuffix()}`;
};

export type BranchTemplateProblem = 'unknown-placeholder' | 'missing-slug' | BranchNameProblem;

export const branchTemplateProblem = ({
  template,
}: {
  readonly template: string;
}): BranchTemplateProblem | null => {
  if (unknownBranchPlaceholders({ template }).length > 0) {
    return 'unknown-placeholder';
  }
  if (!template.includes('{slug}')) {
    return 'missing-slug';
  }
  const sample = { prefix: 'p', slug: 'work', user: 'me' };
  return (
    branchNameProblem({ name: buildBranchName({ template, values: sample }) }) ??
    branchNameProblem({
      name: buildBranchName({ template, values: { ...sample, 'task-id': 't-1' } }),
    })
  );
};
