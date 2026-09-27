import { WIREFRAME_LIMITS, type WireframeIssue } from './schema';

type RawRecord = Readonly<Record<string, unknown>>;

type Expansion =
  | Readonly<{ status: 'expanded'; value: unknown }>
  | Readonly<{ status: 'invalid'; issues: ReadonlyArray<WireframeIssue> }>;

type Ctx = {
  readonly patterns: ReadonlyMap<string, unknown>;
  readonly issues: WireframeIssue[];
  readonly counters: Map<string, number>;
};

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g;

const USE_KEYS = new Set(['use', 'with', 'id', 'note', 'only', 'hidden']);

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fill = ({
  value,
  values,
}: {
  readonly value: unknown;
  readonly values: Readonly<Record<string, string>>;
}): unknown => {
  if (typeof value === 'string') {
    return value.replace(PLACEHOLDER, (match, key: string) => values[key] ?? match);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => fill({ value: entry, values }));
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, fill({ value: entry, values })]),
  );
};

const prefixIds = ({
  value,
  prefix,
  isRoot,
}: {
  readonly value: unknown;
  readonly prefix: string;
  readonly isRoot: boolean;
}): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => prefixIds({ value: entry, prefix, isRoot: false }));
  }
  if (!isRecord(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'id' && typeof entry === 'string') {
      out[key] = isRoot ? prefix : `${prefix}-${entry}`;
      continue;
    }
    if (key === 'children' || key === 'items') {
      out[key] = prefixIds({ value: entry, prefix, isRoot: false });
      continue;
    }
    out[key] = entry;
  }
  if (isRoot && out['id'] === undefined) {
    out['id'] = prefix;
  }
  return out;
};

const withValues = ({
  value,
  path,
  ctx,
}: {
  readonly value: unknown;
  readonly path: string;
  readonly ctx: Ctx;
}): Readonly<Record<string, string>> => {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    ctx.issues.push({ path, message: 'expected an object of text values' });
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' && typeof entry !== 'number') {
      ctx.issues.push({ path: `${path}.${key}`, message: 'expected a text value' });
      continue;
    }
    out[key] = String(entry);
  }
  return out;
};

const expandNode = ({
  value,
  path,
  ctx,
  stack,
}: {
  readonly value: unknown;
  readonly path: string;
  readonly ctx: Ctx;
  readonly stack: ReadonlyArray<string>;
}): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      expandNode({ value: entry, path: `${path}[${index}]`, ctx, stack }),
    );
  }
  if (!isRecord(value)) {
    return value;
  }
  const use = value['use'];
  if (use === undefined) {
    const children = value['children'];
    if (children === undefined) {
      return value;
    }
    return {
      ...value,
      children: expandNode({ value: children, path: `${path}.children`, ctx, stack }),
    };
  }
  if (typeof use !== 'string' || !ctx.patterns.has(use)) {
    ctx.issues.push({ path: `${path}.use`, message: `no pattern named "${String(use)}"` });
    return value;
  }
  if (stack.includes(use)) {
    ctx.issues.push({
      path: `${path}.use`,
      message: `the pattern "${use}" uses itself through ${[...stack, use].join(' > ')}`,
    });
    return value;
  }
  const extra = Object.keys(value).filter((key) => !USE_KEYS.has(key));
  if (extra.length > 0) {
    ctx.issues.push({
      path,
      message: `a pattern use only takes use, with, id, note, only and hidden, not ${extra.join(', ')}`,
    });
    return value;
  }
  const count = (ctx.counters.get(use) ?? 0) + 1;
  ctx.counters.set(use, count);
  const id = typeof value['id'] === 'string' ? value['id'] : `${use}-${count}`;
  const values = withValues({ value: value['with'], path: `${path}.with`, ctx });
  const filled = fill({ value: ctx.patterns.get(use), values });
  const expanded = expandNode({ value: filled, path, ctx, stack: [...stack, use] });
  const prefixed = prefixIds({ value: expanded, prefix: id, isRoot: true });
  if (!isRecord(prefixed)) {
    ctx.issues.push({ path: `${path}.use`, message: `the pattern "${use}" is not a node` });
    return value;
  }
  const overrides = Object.fromEntries(
    ['note', 'only', 'hidden']
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, value[key]]),
  );
  return { ...prefixed, ...overrides, pattern: use };
};

export const expandWireframePatterns = ({ value }: { readonly value: unknown }): Expansion => {
  if (!isRecord(value) || value['patterns'] === undefined) {
    return { status: 'expanded', value };
  }
  const raw = value['patterns'];
  if (!isRecord(raw)) {
    return {
      status: 'invalid',
      issues: [{ path: 'patterns', message: 'expected an object of named patterns' }],
    };
  }
  const names = Object.keys(raw);
  if (names.length > WIREFRAME_LIMITS.maxPatterns) {
    return {
      status: 'invalid',
      issues: [
        {
          path: 'patterns',
          message: `more than the ${WIREFRAME_LIMITS.maxPatterns} pattern limit`,
        },
      ],
    };
  }
  const ctx: Ctx = {
    patterns: new Map(Object.entries(raw)),
    issues: [],
    counters: new Map(),
  };
  const screens = Array.isArray(value['screens'])
    ? value['screens'].map((screen, index) =>
        isRecord(screen)
          ? {
              ...screen,
              root: expandNode({
                value: screen['root'],
                path: `screens[${index}].root`,
                ctx,
                stack: [],
              }),
            }
          : screen,
      )
    : value['screens'];
  if (ctx.issues.length > 0) {
    return { status: 'invalid', issues: ctx.issues };
  }
  const rest = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'patterns'));
  return { status: 'expanded', value: { ...rest, screens } };
};
