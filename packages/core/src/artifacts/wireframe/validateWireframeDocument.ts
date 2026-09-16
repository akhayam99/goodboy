import {
  GENERIC_THEME_NAME,
  MAX_WIREFRAME_ADJUSTMENTS,
  WIREFRAME_ALIGNMENTS,
  WIREFRAME_BUTTON_VARIANTS,
  WIREFRAME_DIRECTIONS,
  WIREFRAME_IMAGE_RATIOS,
  WIREFRAME_INPUT_TYPES,
  WIREFRAME_JUSTIFICATIONS,
  WIREFRAME_LIMITS,
  WIREFRAME_NAVIGATION_VARIANTS,
  WIREFRAME_NODE_KINDS,
  WIREFRAME_SCHEMA_VERSION,
  WIREFRAME_SPACINGS,
  WIREFRAME_TEXT_VARIANTS,
  WIREFRAME_THEME_COLOR_TOKENS,
  WIREFRAME_THEME_FONTS,
  WIREFRAME_THEME_RADII,
  WIREFRAME_VIEWPORTS,
  type WireframeAction,
  type WireframeAdjustment,
  type WireframeAdjustmentChange,
  type WireframeAlignment,
  type WireframeButtonVariant,
  type WireframeDirection,
  type WireframeDocument,
  type WireframeImageRatio,
  type WireframeInputType,
  type WireframeIssue,
  type WireframeJustification,
  type WireframeNavigationVariant,
  type WireframeNode,
  type WireframeScreen,
  type WireframeSpacing,
  type WireframeTextVariant,
  type WireframeTheme,
  type WireframeThemeFont,
  type WireframeThemeRadius,
  type WireframeTransition,
  type WireframeValidationResult,
  type WireframeViewport,
} from './schema';

type RawAdjustment = Readonly<{
  change: WireframeAdjustmentChange;
  path: string;
  message: string;
}>;

type Ctx = {
  readonly issues: WireframeIssue[];
  readonly adjustments: RawAdjustment[];
  nodeCount: number;
  readonly nodeIds: Set<string>;
  readonly interactiveNodeIds: Set<string>;
  readonly inlineActions: Map<string, WireframeAction>;
  readonly actionRefs: { readonly screenIds: string[]; readonly stateKeys: string[] };
};

const describeAction = ({ action }: { readonly action: WireframeAction }): string =>
  action.type === 'navigate' ? `navigate to "${action.toScreenId}"` : `toggle "${action.stateKey}"`;

const isSameAction = ({
  left,
  right,
}: {
  readonly left: WireframeAction;
  readonly right: WireframeAction;
}): boolean => {
  if (left.type === 'navigate') {
    return right.type === 'navigate' && right.toScreenId === left.toScreenId;
  }
  return right.type === 'toggle' && right.stateKey === left.stateKey;
};

const MARKUP_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/<\s*\/?\s*[a-zA-Z]/, 'raw html is not allowed'],
  [/&(?:#\d+|[a-zA-Z]+);/, 'html entities are not allowed'],
  [/javascript\s*:/i, 'script urls are not allowed'],
  [/\bdata\s*:/i, 'data urls are not allowed'],
  [/https?:\/\//i, 'external urls are not allowed'],
  [/url\s*\(/i, 'css url() is not allowed'],
  [/\{[^}]*:[^}]*\}/, 'raw css is not allowed'],
  [/(?:^|[\s;])(?:on[a-z]+|style)\s*=/i, 'inline handlers and styles are not allowed'],
];

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const ID_PATTERN = new RegExp(`^[a-zA-Z][a-zA-Z0-9_-]{0,${WIREFRAME_LIMITS.maxIdLength - 1}}$`);

const CLIP_MARK = '\u2026';

const CLIP_WORD_REACH = 24;

const clipText = ({ value, max }: { readonly value: string; readonly max: number }): string => {
  const head = value.slice(0, max - CLIP_MARK.length);
  const lastSpace = head.lastIndexOf(' ');
  const reachedBack = head.length - lastSpace <= CLIP_WORD_REACH;
  const cut = lastSpace > 0 && reachedBack ? lastSpace : head.length;
  return `${head.slice(0, cut).trimEnd()}${CLIP_MARK}`;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = ({ ctx, path, message }: { ctx: Ctx; path: string; message: string }): null => {
  ctx.issues.push({ path, message });
  return null;
};

const dropUnknownKeys = ({
  ctx,
  path,
  value,
  allowed,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly allowed: ReadonlyArray<string>;
}): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      ctx.adjustments.push({
        change: 'dropped',
        path: `${path}.${key}`,
        message: 'is not part of the wireframe contract, so it was dropped',
      });
    }
  }
};

const safeText = ({
  ctx,
  path,
  value,
  max,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly max: number;
}): string | null => {
  if (typeof value !== 'string') {
    return fail({ ctx, path, message: 'expected a string' });
  }
  for (const [pattern, message] of MARKUP_PATTERNS) {
    if (pattern.test(value)) {
      return fail({ ctx, path, message });
    }
  }
  if (value.length <= max) {
    return value;
  }
  ctx.adjustments.push({
    change: 'clipped',
    path,
    message: `was longer than the ${max} character limit, so it was shortened to fit`,
  });
  return clipText({ value, max });
};

const requiredText = ({
  ctx,
  path,
  value,
  max,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly max: number;
}): string | null => {
  const text = safeText({ ctx, path, value, max });
  if (text === null) {
    return null;
  }
  if (text.trim().length === 0) {
    return fail({ ctx, path, message: 'must not be empty' });
  }
  return text;
};

const identifier = ({
  ctx,
  path,
  value,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
}): string | null => {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    return fail({
      ctx,
      path,
      message: 'expected an id of letters, digits, dashes or underscores starting with a letter',
    });
  }
  return value;
};

const enumValue = <T extends string>({
  ctx,
  path,
  value,
  options,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly options: ReadonlyArray<T>;
}): T | null => {
  if (typeof value === 'string' && (options as ReadonlyArray<string>).includes(value)) {
    return value as T;
  }
  return fail({ ctx, path, message: `expected one of ${options.join(', ')}` });
};

const describeValue = ({ value }: { readonly value: unknown }): string => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (value === undefined) {
    return 'nothing';
  }
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'a list' : 'that value';
};

const record = ({
  ctx,
  path,
  message,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly message: string;
}): void => {
  ctx.adjustments.push({ change: 'moved', path, message });
};

const spacingForSize = ({ size }: { readonly size: number }): WireframeSpacing => {
  if (size <= 0) {
    return 'none';
  }
  if (size <= 8) {
    return 'sm';
  }
  return size <= 20 ? 'md' : 'lg';
};

const SPACING_NEAR: Readonly<Record<string, WireframeSpacing>> = {
  zero: 'none',
  flat: 'none',
  tight: 'sm',
  compact: 'sm',
  xxs: 'sm',
  xs: 'sm',
  s: 'sm',
  small: 'sm',
  m: 'md',
  medium: 'md',
  normal: 'md',
  default: 'md',
  regular: 'md',
  l: 'lg',
  large: 'lg',
  xl: 'lg',
  xxl: 'lg',
  '2xl': 'lg',
  '3xl': 'lg',
  huge: 'lg',
  loose: 'lg',
  wide: 'lg',
};

const DIRECTION_NEAR: Readonly<Record<string, WireframeDirection>> = {
  horizontal: 'row',
  x: 'row',
  inline: 'row',
  'row-reverse': 'row',
  vertical: 'column',
  y: 'column',
  col: 'column',
  stack: 'column',
  'column-reverse': 'column',
};

const ALIGNMENT_NEAR: Readonly<Record<string, WireframeAlignment>> = {
  'flex-start': 'start',
  left: 'start',
  top: 'start',
  baseline: 'start',
  centre: 'center',
  middle: 'center',
  'flex-end': 'end',
  right: 'end',
  bottom: 'end',
  fill: 'stretch',
  full: 'stretch',
};

const JUSTIFICATION_NEAR: Readonly<Record<string, WireframeJustification>> = {
  'flex-start': 'start',
  left: 'start',
  top: 'start',
  centre: 'center',
  middle: 'center',
  'flex-end': 'end',
  right: 'end',
  bottom: 'end',
  'space-between': 'between',
  'space-around': 'between',
  'space-evenly': 'between',
  around: 'between',
  evenly: 'between',
};

const TEXT_VARIANT_NEAR: Readonly<Record<string, WireframeTextVariant>> = {
  h1: 'title',
  h2: 'title',
  heading: 'title',
  headline: 'title',
  display: 'title',
  h3: 'subtitle',
  h4: 'subtitle',
  subheading: 'subtitle',
  subhead: 'subtitle',
  lead: 'subtitle',
  paragraph: 'body',
  text: 'body',
  default: 'body',
  small: 'caption',
  hint: 'caption',
  helper: 'caption',
  meta: 'caption',
  overline: 'label',
  eyebrow: 'label',
  tag: 'label',
};

const BUTTON_VARIANT_NEAR: Readonly<Record<string, WireframeButtonVariant>> = {
  cta: 'primary',
  filled: 'primary',
  solid: 'primary',
  default: 'secondary',
  outline: 'secondary',
  outlined: 'secondary',
  tonal: 'secondary',
  tertiary: 'ghost',
  link: 'ghost',
  text: 'ghost',
  plain: 'ghost',
  quiet: 'ghost',
  destructive: 'danger',
  error: 'danger',
  warning: 'danger',
  critical: 'danger',
};

const INPUT_TYPE_NEAR: Readonly<Record<string, WireframeInputType>> = {
  date: 'text',
  time: 'text',
  datetime: 'text',
  tel: 'text',
  phone: 'text',
  url: 'text',
  file: 'text',
  string: 'text',
  num: 'number',
  numeric: 'number',
  integer: 'number',
  currency: 'number',
  multiline: 'textarea',
  textbox: 'textarea',
  longtext: 'textarea',
  dropdown: 'select',
  combobox: 'select',
  picker: 'select',
  radio: 'checkbox',
  toggle: 'checkbox',
  switch: 'checkbox',
};

const IMAGE_RATIO_NEAR: Readonly<Record<string, WireframeImageRatio>> = {
  '1:1': 'square',
  '1x1': 'square',
  landscape: 'wide',
  banner: 'wide',
  hero: 'wide',
  '16:9': 'wide',
  '4:3': 'wide',
  '3:2': 'wide',
  portrait: 'tall',
  '9:16': 'tall',
  '3:4': 'tall',
  circle: 'avatar',
  round: 'avatar',
  profile: 'avatar',
  thumbnail: 'avatar',
};

const NAVIGATION_VARIANT_NEAR: Readonly<Record<string, WireframeNavigationVariant>> = {
  header: 'top',
  topbar: 'top',
  navbar: 'top',
  appbar: 'top',
  sidebar: 'side',
  rail: 'side',
  drawer: 'side',
  left: 'side',
  tabbar: 'tabs',
  segmented: 'tabs',
  pills: 'tabs',
  footer: 'bottom',
  tabbarbottom: 'bottom',
};

const VIEWPORT_NEAR: Readonly<Record<string, WireframeViewport>> = {
  phone: 'mobile',
  handset: 'mobile',
  sm: 'mobile',
  small: 'mobile',
  ipad: 'tablet',
  md: 'tablet',
  medium: 'tablet',
  web: 'desktop',
  laptop: 'desktop',
  lg: 'desktop',
  large: 'desktop',
  wide: 'desktop',
};

const THEME_FONT_NEAR: Readonly<Record<string, WireframeThemeFont>> = {
  'sans-serif': 'sans',
  sansserif: 'sans',
  system: 'sans',
  ui: 'sans',
  monospace: 'mono',
  code: 'mono',
  slab: 'serif',
};

const THEME_RADIUS_NEAR: Readonly<Record<string, WireframeThemeRadius>> = {
  square: 'none',
  sharp: 'none',
  xs: 'sm',
  xl: 'lg',
  xxl: 'lg',
  '2xl': 'lg',
  '3xl': 'lg',
  rounded: 'md',
  pill: 'full',
  circle: 'full',
  round: 'full',
};

const nearestOf = <T extends string>({
  value,
  near,
}: {
  readonly value: unknown;
  readonly near: Readonly<Record<string, T>>;
}): T | null => {
  if (typeof value !== 'string') {
    return null;
  }
  return (
    near[
      value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    ] ?? null
  );
};

const nearestSpacing = ({ value }: { readonly value: unknown }): WireframeSpacing | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return spacingForSize({ size: value });
  }
  const named = nearestOf({ value, near: SPACING_NEAR });
  if (named !== null) {
    return named;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const size = Number.parseFloat(value);
  return Number.isNaN(size) ? null : spacingForSize({ size });
};

const presentationEnum = <T extends string>({
  ctx,
  path,
  value,
  options,
  fallback,
  nearest,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly options: ReadonlyArray<T>;
  readonly fallback: T;
  readonly nearest: T | null;
}): T => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'string' && (options as ReadonlyArray<string>).includes(value)) {
    return value as T;
  }
  const resolved = nearest ?? fallback;
  record({
    ctx,
    path,
    message: `${describeValue({ value })} is not one of ${options.join(', ')}, so it was drawn as ${resolved}`,
  });
  return resolved;
};

const presentationFlag = ({
  ctx,
  path,
  value,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
}): boolean => {
  if (value === undefined || typeof value === 'boolean') {
    return value === true;
  }
  record({
    ctx,
    path,
    message: `${describeValue({ value })} is not true or false, so it was drawn as false`,
  });
  return false;
};

const DEFAULT_GRID_COLUMNS = 2;

const gridColumns = ({
  ctx,
  path,
  value,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
}): number => {
  const isExact =
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= WIREFRAME_LIMITS.maxGridColumns;
  if (isExact) {
    return value;
  }
  const raw = typeof value === 'number' ? value : Number.parseFloat(String(value));
  const drawn = Number.isFinite(raw)
    ? Math.min(Math.max(Math.round(raw), 1), WIREFRAME_LIMITS.maxGridColumns)
    : DEFAULT_GRID_COLUMNS;
  record({
    ctx,
    path,
    message: `${describeValue({ value })} is not a column count from 1 to ${WIREFRAME_LIMITS.maxGridColumns}, so the grid was drawn with ${drawn} columns`,
  });
  return drawn;
};

const spacing = ({
  ctx,
  path,
  value,
  fallback,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly fallback: WireframeSpacing;
}): WireframeSpacing =>
  presentationEnum({
    ctx,
    path,
    value,
    options: WIREFRAME_SPACINGS,
    fallback,
    nearest: nearestSpacing({ value }),
  });

const parseAction = ({
  ctx,
  path,
  value,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
}): WireframeAction | null => {
  if (!isRecord(value)) {
    return fail({ ctx, path, message: 'expected an action object' });
  }
  const type = value['type'];
  if (type === 'navigate') {
    dropUnknownKeys({ ctx, path, value, allowed: ['type', 'toScreenId'] });
    const target = identifier({ ctx, path: `${path}.toScreenId`, value: value['toScreenId'] });
    if (target === null) {
      return null;
    }
    ctx.actionRefs.screenIds.push(target);
    return { type: 'navigate', toScreenId: target };
  }
  if (type === 'toggle') {
    dropUnknownKeys({ ctx, path, value, allowed: ['type', 'stateKey'] });
    const key = identifier({ ctx, path: `${path}.stateKey`, value: value['stateKey'] });
    if (key === null) {
      return null;
    }
    ctx.actionRefs.stateKeys.push(key);
    return { type: 'toggle', stateKey: key };
  }
  return fail({ ctx, path: `${path}.type`, message: 'expected navigate or toggle' });
};

const optionalAction = ({
  ctx,
  path,
  value,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
}): WireframeAction | null => (value === undefined ? null : parseAction({ ctx, path, value }));

const parseChildren = ({
  ctx,
  path,
  value,
  depth,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly depth: number;
}): ReadonlyArray<WireframeNode> => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail({ ctx, path, message: 'expected an array of nodes' });
    return [];
  }
  const out: WireframeNode[] = [];
  value.forEach((child, index) => {
    const node = parseNode({ ctx, path: `${path}[${index}]`, value: child, depth: depth + 1 });
    if (node !== null) {
      out.push(node);
    }
  });
  return out;
};

const parseNode = ({
  ctx,
  path,
  value,
  depth,
}: {
  readonly ctx: Ctx;
  readonly path: string;
  readonly value: unknown;
  readonly depth: number;
}): WireframeNode | null => {
  if (depth > WIREFRAME_LIMITS.maxDepth) {
    return fail({
      ctx,
      path,
      message: `nesting deeper than the ${WIREFRAME_LIMITS.maxDepth} level limit`,
    });
  }
  if (!isRecord(value)) {
    return fail({ ctx, path, message: 'expected a node object' });
  }
  ctx.nodeCount += 1;
  if (ctx.nodeCount > WIREFRAME_LIMITS.maxNodes) {
    return fail({
      ctx,
      path,
      message: `more than the ${WIREFRAME_LIMITS.maxNodes} node limit`,
    });
  }
  const kind = enumValue({
    ctx,
    path: `${path}.kind`,
    value: value['kind'],
    options: WIREFRAME_NODE_KINDS,
  });
  if (kind === null) {
    return null;
  }
  const id = identifier({ ctx, path: `${path}.id`, value: value['id'] });
  if (id === null) {
    return null;
  }
  if (ctx.nodeIds.has(id)) {
    return fail({ ctx, path: `${path}.id`, message: `duplicate node id "${id}"` });
  }
  ctx.nodeIds.add(id);
  const note =
    value['note'] === undefined
      ? null
      : safeText({
          ctx,
          path: `${path}.note`,
          value: value['note'],
          max: WIREFRAME_LIMITS.maxTextLength,
        });
  const noteField = note === null ? {} : { note };

  if (kind === 'stack') {
    dropUnknownKeys({
      ctx,
      path,
      value,
      allowed: [
        'id',
        'kind',
        'note',
        'direction',
        'gap',
        'padding',
        'align',
        'justify',
        'surface',
        'children',
      ],
    });
    const direction = presentationEnum({
      ctx,
      path: `${path}.direction`,
      value: value['direction'],
      options: WIREFRAME_DIRECTIONS,
      fallback: 'column',
      nearest: nearestOf({ value: value['direction'], near: DIRECTION_NEAR }),
    });
    const gap = spacing({ ctx, path: `${path}.gap`, value: value['gap'], fallback: 'md' });
    const padding = spacing({
      ctx,
      path: `${path}.padding`,
      value: value['padding'],
      fallback: 'none',
    });
    const align = presentationEnum({
      ctx,
      path: `${path}.align`,
      value: value['align'],
      options: WIREFRAME_ALIGNMENTS,
      fallback: 'stretch',
      nearest: nearestOf({ value: value['align'], near: ALIGNMENT_NEAR }),
    });
    const justify = presentationEnum({
      ctx,
      path: `${path}.justify`,
      value: value['justify'],
      options: WIREFRAME_JUSTIFICATIONS,
      fallback: 'start',
      nearest: nearestOf({ value: value['justify'], near: JUSTIFICATION_NEAR }),
    });
    const surface = presentationFlag({
      ctx,
      path: `${path}.surface`,
      value: value['surface'],
    });
    const children = parseChildren({
      ctx,
      path: `${path}.children`,
      value: value['children'],
      depth,
    });
    return {
      id,
      kind,
      ...noteField,
      direction,
      gap,
      padding,
      align,
      justify,
      surface,
      children,
    };
  }

  if (kind === 'grid') {
    dropUnknownKeys({
      ctx,
      path,
      value,
      allowed: ['id', 'kind', 'note', 'columns', 'gap', 'padding', 'children'],
    });
    const columns = gridColumns({ ctx, path: `${path}.columns`, value: value['columns'] });
    const gap = spacing({ ctx, path: `${path}.gap`, value: value['gap'], fallback: 'md' });
    const padding = spacing({
      ctx,
      path: `${path}.padding`,
      value: value['padding'],
      fallback: 'none',
    });
    const children = parseChildren({
      ctx,
      path: `${path}.children`,
      value: value['children'],
      depth,
    });
    return { id, kind, ...noteField, columns, gap, padding, children };
  }

  if (kind === 'text') {
    dropUnknownKeys({ ctx, path, value, allowed: ['id', 'kind', 'note', 'text', 'variant'] });
    const text = requiredText({
      ctx,
      path: `${path}.text`,
      value: value['text'],
      max: WIREFRAME_LIMITS.maxTextLength,
    });
    const variant = presentationEnum({
      ctx,
      path: `${path}.variant`,
      value: value['variant'],
      options: WIREFRAME_TEXT_VARIANTS,
      fallback: 'body',
      nearest: nearestOf({ value: value['variant'], near: TEXT_VARIANT_NEAR }),
    });
    if (text === null) {
      return null;
    }
    return { id, kind, ...noteField, text, variant };
  }

  if (kind === 'button') {
    dropUnknownKeys({
      ctx,
      path,
      value,
      allowed: ['id', 'kind', 'note', 'label', 'variant', 'action'],
    });
    const label = requiredText({
      ctx,
      path: `${path}.label`,
      value: value['label'],
      max: WIREFRAME_LIMITS.maxTextLength,
    });
    const variant = presentationEnum({
      ctx,
      path: `${path}.variant`,
      value: value['variant'],
      options: WIREFRAME_BUTTON_VARIANTS,
      fallback: 'secondary',
      nearest: nearestOf({ value: value['variant'], near: BUTTON_VARIANT_NEAR }),
    });
    const action = optionalAction({ ctx, path: `${path}.action`, value: value['action'] });
    if (label === null) {
      return null;
    }
    ctx.interactiveNodeIds.add(id);
    if (action !== null) {
      ctx.inlineActions.set(id, action);
    }
    return { id, kind, ...noteField, label, variant, ...(action !== null && { action }) };
  }

  if (kind === 'input') {
    dropUnknownKeys({
      ctx,
      path,
      value,
      allowed: ['id', 'kind', 'note', 'inputType', 'label', 'placeholder', 'options'],
    });
    const inputType = presentationEnum({
      ctx,
      path: `${path}.inputType`,
      value: value['inputType'],
      options: WIREFRAME_INPUT_TYPES,
      fallback: 'text',
      nearest: nearestOf({ value: value['inputType'], near: INPUT_TYPE_NEAR }),
    });
    const label =
      value['label'] === undefined
        ? null
        : safeText({
            ctx,
            path: `${path}.label`,
            value: value['label'],
            max: WIREFRAME_LIMITS.maxTextLength,
          });
    const placeholder =
      value['placeholder'] === undefined
        ? null
        : safeText({
            ctx,
            path: `${path}.placeholder`,
            value: value['placeholder'],
            max: WIREFRAME_LIMITS.maxTextLength,
          });
    const rawOptions = value['options'];
    const options: string[] = [];
    if (rawOptions !== undefined) {
      if (!Array.isArray(rawOptions)) {
        fail({ ctx, path: `${path}.options`, message: 'expected an array of strings' });
      } else if (rawOptions.length > WIREFRAME_LIMITS.maxSelectOptions) {
        fail({
          ctx,
          path: `${path}.options`,
          message: `more than the ${WIREFRAME_LIMITS.maxSelectOptions} option limit`,
        });
      } else {
        rawOptions.forEach((option, index) => {
          const parsed = requiredText({
            ctx,
            path: `${path}.options[${index}]`,
            value: option,
            max: WIREFRAME_LIMITS.maxTextLength,
          });
          if (parsed !== null) {
            options.push(parsed);
          }
        });
      }
    }
    return {
      id,
      kind,
      ...noteField,
      inputType,
      ...(label !== null && { label }),
      ...(placeholder !== null && { placeholder }),
      ...(rawOptions !== undefined && { options }),
    };
  }

  if (kind === 'list') {
    dropUnknownKeys({ ctx, path, value, allowed: ['id', 'kind', 'note', 'items'] });
    const rawItems = value['items'];
    if (!Array.isArray(rawItems)) {
      return fail({ ctx, path: `${path}.items`, message: 'expected an array of list items' });
    }
    if (rawItems.length > WIREFRAME_LIMITS.maxListItems) {
      return fail({
        ctx,
        path: `${path}.items`,
        message: `more than the ${WIREFRAME_LIMITS.maxListItems} item limit`,
      });
    }
    const items: Array<{
      readonly id: string;
      readonly title: string;
      readonly subtitle?: string;
      readonly action?: WireframeAction;
    }> = [];
    rawItems.forEach((raw, index) => {
      const itemPath = `${path}.items[${index}]`;
      if (!isRecord(raw)) {
        fail({ ctx, path: itemPath, message: 'expected a list item object' });
        return;
      }
      dropUnknownKeys({
        ctx,
        path: itemPath,
        value: raw,
        allowed: ['id', 'title', 'subtitle', 'action'],
      });
      const itemId = identifier({ ctx, path: `${itemPath}.id`, value: raw['id'] });
      const title = requiredText({
        ctx,
        path: `${itemPath}.title`,
        value: raw['title'],
        max: WIREFRAME_LIMITS.maxTextLength,
      });
      const subtitle =
        raw['subtitle'] === undefined
          ? null
          : safeText({
              ctx,
              path: `${itemPath}.subtitle`,
              value: raw['subtitle'],
              max: WIREFRAME_LIMITS.maxTextLength,
            });
      const action = optionalAction({ ctx, path: `${itemPath}.action`, value: raw['action'] });
      if (itemId === null || title === null) {
        return;
      }
      if (ctx.nodeIds.has(itemId)) {
        fail({ ctx, path: `${itemPath}.id`, message: `duplicate node id "${itemId}"` });
        return;
      }
      ctx.nodeIds.add(itemId);
      ctx.interactiveNodeIds.add(itemId);
      if (action !== null) {
        ctx.inlineActions.set(itemId, action);
      }
      items.push({
        id: itemId,
        title,
        ...(subtitle !== null && { subtitle }),
        ...(action !== null && { action }),
      });
    });
    return { id, kind, ...noteField, items };
  }

  if (kind === 'table') {
    dropUnknownKeys({ ctx, path, value, allowed: ['id', 'kind', 'note', 'columns', 'rows'] });
    const rawColumns = value['columns'];
    const rawRows = value['rows'];
    if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
      return fail({
        ctx,
        path: `${path}.columns`,
        message: 'expected a non-empty array of strings',
      });
    }
    if (rawColumns.length > WIREFRAME_LIMITS.maxTableColumns) {
      return fail({
        ctx,
        path: `${path}.columns`,
        message: `more than the ${WIREFRAME_LIMITS.maxTableColumns} column limit`,
      });
    }
    if (!Array.isArray(rawRows)) {
      return fail({ ctx, path: `${path}.rows`, message: 'expected an array of rows' });
    }
    if (rawRows.length > WIREFRAME_LIMITS.maxTableRows) {
      return fail({
        ctx,
        path: `${path}.rows`,
        message: `more than the ${WIREFRAME_LIMITS.maxTableRows} row limit`,
      });
    }
    const columns: string[] = [];
    rawColumns.forEach((column, index) => {
      const parsed = requiredText({
        ctx,
        path: `${path}.columns[${index}]`,
        value: column,
        max: WIREFRAME_LIMITS.maxTextLength,
      });
      if (parsed !== null) {
        columns.push(parsed);
      }
    });
    const rows: Array<ReadonlyArray<string>> = [];
    rawRows.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) {
        fail({ ctx, path: `${path}.rows[${rowIndex}]`, message: 'expected an array of cells' });
        return;
      }
      if (row.length !== rawColumns.length) {
        fail({
          ctx,
          path: `${path}.rows[${rowIndex}]`,
          message: `expected ${rawColumns.length} cells to match the columns`,
        });
        return;
      }
      const cells: string[] = [];
      row.forEach((cell, cellIndex) => {
        const parsed = safeText({
          ctx,
          path: `${path}.rows[${rowIndex}][${cellIndex}]`,
          value: cell,
          max: WIREFRAME_LIMITS.maxTextLength,
        });
        if (parsed !== null) {
          cells.push(parsed);
        }
      });
      rows.push(cells);
    });
    return { id, kind, ...noteField, columns, rows };
  }

  if (kind === 'image') {
    dropUnknownKeys({ ctx, path, value, allowed: ['id', 'kind', 'note', 'alt', 'ratio'] });
    const alt = requiredText({
      ctx,
      path: `${path}.alt`,
      value: value['alt'],
      max: WIREFRAME_LIMITS.maxTextLength,
    });
    const ratio = presentationEnum({
      ctx,
      path: `${path}.ratio`,
      value: value['ratio'],
      options: WIREFRAME_IMAGE_RATIOS,
      fallback: 'wide',
      nearest: nearestOf({ value: value['ratio'], near: IMAGE_RATIO_NEAR }),
    });
    if (alt === null) {
      return null;
    }
    return { id, kind, ...noteField, alt, ratio };
  }

  dropUnknownKeys({ ctx, path, value, allowed: ['id', 'kind', 'note', 'variant', 'items'] });
  const variant = presentationEnum({
    ctx,
    path: `${path}.variant`,
    value: value['variant'],
    options: WIREFRAME_NAVIGATION_VARIANTS,
    fallback: 'top',
    nearest: nearestOf({ value: value['variant'], near: NAVIGATION_VARIANT_NEAR }),
  });
  const rawItems = value['items'];
  if (!Array.isArray(rawItems)) {
    return fail({ ctx, path: `${path}.items`, message: 'expected an array of navigation items' });
  }
  if (rawItems.length > WIREFRAME_LIMITS.maxNavigationItems) {
    return fail({
      ctx,
      path: `${path}.items`,
      message: `more than the ${WIREFRAME_LIMITS.maxNavigationItems} item limit`,
    });
  }
  const items: Array<{
    readonly id: string;
    readonly label: string;
    readonly isActive?: boolean;
    readonly action?: WireframeAction;
  }> = [];
  rawItems.forEach((raw, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord(raw)) {
      fail({ ctx, path: itemPath, message: 'expected a navigation item object' });
      return;
    }
    dropUnknownKeys({
      ctx,
      path: itemPath,
      value: raw,
      allowed: ['id', 'label', 'isActive', 'action'],
    });
    const itemId = identifier({ ctx, path: `${itemPath}.id`, value: raw['id'] });
    const label = requiredText({
      ctx,
      path: `${itemPath}.label`,
      value: raw['label'],
      max: WIREFRAME_LIMITS.maxTextLength,
    });
    const action = optionalAction({ ctx, path: `${itemPath}.action`, value: raw['action'] });
    const isActive = presentationFlag({
      ctx,
      path: `${itemPath}.isActive`,
      value: raw['isActive'],
    });
    if (itemId === null || label === null) {
      return;
    }
    if (ctx.nodeIds.has(itemId)) {
      fail({ ctx, path: `${itemPath}.id`, message: `duplicate node id "${itemId}"` });
      return;
    }
    ctx.nodeIds.add(itemId);
    ctx.interactiveNodeIds.add(itemId);
    if (action !== null) {
      ctx.inlineActions.set(itemId, action);
    }
    items.push({
      id: itemId,
      label,
      isActive,
      ...(action !== null && { action }),
    });
  });
  return { id, kind, ...noteField, variant, items };
};

const parseTheme = ({
  ctx,
  value,
}: {
  readonly ctx: Ctx;
  readonly value: unknown;
}): WireframeTheme => {
  if (value === undefined) {
    return { name: GENERIC_THEME_NAME };
  }
  if (!isRecord(value)) {
    fail({ ctx, path: 'theme', message: 'expected a theme object' });
    return { name: GENERIC_THEME_NAME };
  }
  dropUnknownKeys({
    ctx,
    path: 'theme',
    value,
    allowed: ['name', 'font', 'radius', 'colors', 'sources'],
  });
  const name =
    safeText({ ctx, path: 'theme.name', value: value['name'], max: 80 }) ?? GENERIC_THEME_NAME;
  const font = presentationEnum({
    ctx,
    path: 'theme.font',
    value: value['font'],
    options: WIREFRAME_THEME_FONTS,
    fallback: 'sans',
    nearest: nearestOf({ value: value['font'], near: THEME_FONT_NEAR }),
  });
  const radius = presentationEnum({
    ctx,
    path: 'theme.radius',
    value: value['radius'],
    options: WIREFRAME_THEME_RADII,
    fallback: 'md',
    nearest: nearestOf({ value: value['radius'], near: THEME_RADIUS_NEAR }),
  });
  const colors: Record<string, string> = {};
  const rawColors = value['colors'];
  if (rawColors !== undefined) {
    if (!isRecord(rawColors)) {
      record({
        ctx,
        path: 'theme.colors',
        message: `${describeValue({ value: rawColors })} is not a color token object, so the generic palette was used`,
      });
    } else {
      dropUnknownKeys({
        ctx,
        path: 'theme.colors',
        value: rawColors,
        allowed: WIREFRAME_THEME_COLOR_TOKENS,
      });
      for (const token of WIREFRAME_THEME_COLOR_TOKENS) {
        const raw = rawColors[token];
        if (raw === undefined) {
          continue;
        }
        if (typeof raw !== 'string' || !HEX_COLOR.test(raw)) {
          record({
            ctx,
            path: `theme.colors.${token}`,
            message: `${describeValue({ value: raw })} is not a hex color like #1a1a1a, so the generic ${token} was used`,
          });
          continue;
        }
        colors[token] = raw;
      }
    }
  }
  const sources: string[] = [];
  const rawSources = value['sources'];
  if (rawSources !== undefined) {
    if (!Array.isArray(rawSources)) {
      fail({ ctx, path: 'theme.sources', message: 'expected an array of file references' });
    } else {
      rawSources.slice(0, 20).forEach((source, index) => {
        const parsed = safeText({ ctx, path: `theme.sources[${index}]`, value: source, max: 200 });
        if (parsed !== null) {
          sources.push(parsed);
        }
      });
    }
  }
  return {
    name: name.trim().length === 0 ? GENERIC_THEME_NAME : name,
    font,
    radius,
    ...(Object.keys(colors).length > 0 && { colors }),
    ...(sources.length > 0 && { sources }),
  };
};

const parseScreens = ({
  ctx,
  value,
}: {
  readonly ctx: Ctx;
  readonly value: unknown;
}): ReadonlyArray<WireframeScreen> => {
  if (!Array.isArray(value) || value.length === 0) {
    fail({ ctx, path: 'screens', message: 'expected at least one screen' });
    return [];
  }
  if (value.length > WIREFRAME_LIMITS.maxScreens) {
    fail({
      ctx,
      path: 'screens',
      message: `more than the ${WIREFRAME_LIMITS.maxScreens} screen limit`,
    });
    return [];
  }
  const seen = new Set<string>();
  const screens: WireframeScreen[] = [];
  value.forEach((raw, index) => {
    const path = `screens[${index}]`;
    if (!isRecord(raw)) {
      fail({ ctx, path, message: 'expected a screen object' });
      return;
    }
    dropUnknownKeys({
      ctx,
      path,
      value: raw,
      allowed: ['id', 'title', 'viewport', 'root', 'note'],
    });
    const id = identifier({ ctx, path: `${path}.id`, value: raw['id'] });
    const title = requiredText({
      ctx,
      path: `${path}.title`,
      value: raw['title'],
      max: WIREFRAME_LIMITS.maxTextLength,
    });
    const viewport = presentationEnum({
      ctx,
      path: `${path}.viewport`,
      value: raw['viewport'],
      options: WIREFRAME_VIEWPORTS,
      fallback: 'desktop',
      nearest: nearestOf({ value: raw['viewport'], near: VIEWPORT_NEAR }),
    });
    const note =
      raw['note'] === undefined
        ? null
        : safeText({
            ctx,
            path: `${path}.note`,
            value: raw['note'],
            max: WIREFRAME_LIMITS.maxTextLength,
          });
    const root = parseNode({ ctx, path: `${path}.root`, value: raw['root'], depth: 1 });
    if (id === null || title === null || root === null) {
      return;
    }
    if (seen.has(id)) {
      fail({ ctx, path: `${path}.id`, message: `duplicate screen id "${id}"` });
      return;
    }
    seen.add(id);
    screens.push({ id, title, viewport, root, ...(note !== null && { note }) });
  });
  return screens;
};

const parseTransitions = ({
  ctx,
  value,
  screenIds,
}: {
  readonly ctx: Ctx;
  readonly value: unknown;
  readonly screenIds: ReadonlySet<string>;
}): ReadonlyArray<WireframeTransition> => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail({ ctx, path: 'transitions', message: 'expected an array of transitions' });
    return [];
  }
  if (value.length > WIREFRAME_LIMITS.maxTransitions) {
    fail({
      ctx,
      path: 'transitions',
      message: `more than the ${WIREFRAME_LIMITS.maxTransitions} transition limit`,
    });
    return [];
  }
  const transitions: WireframeTransition[] = [];
  value.forEach((raw, index) => {
    const path = `transitions[${index}]`;
    if (!isRecord(raw)) {
      fail({ ctx, path, message: 'expected a transition object' });
      return;
    }
    dropUnknownKeys({ ctx, path, value: raw, allowed: ['fromNodeId', 'toScreenId', 'label'] });
    const fromNodeId = identifier({ ctx, path: `${path}.fromNodeId`, value: raw['fromNodeId'] });
    const toScreenId = identifier({ ctx, path: `${path}.toScreenId`, value: raw['toScreenId'] });
    const label = requiredText({
      ctx,
      path: `${path}.label`,
      value: raw['label'],
      max: WIREFRAME_LIMITS.maxTextLength,
    });
    if (fromNodeId === null || toScreenId === null || label === null) {
      return;
    }
    if (!ctx.nodeIds.has(fromNodeId)) {
      fail({ ctx, path: `${path}.fromNodeId`, message: `no node with id "${fromNodeId}"` });
      return;
    }
    if (!ctx.interactiveNodeIds.has(fromNodeId)) {
      fail({
        ctx,
        path: `${path}.fromNodeId`,
        message: `node "${fromNodeId}" is not a button, list item or navigation item, so it cannot start a transition`,
      });
      return;
    }
    if (!screenIds.has(toScreenId)) {
      fail({ ctx, path: `${path}.toScreenId`, message: `no screen with id "${toScreenId}"` });
      return;
    }
    const action: WireframeAction = { type: 'navigate', toScreenId };
    const existing = ctx.inlineActions.get(fromNodeId);
    if (existing !== undefined && !isSameAction({ left: existing, right: action })) {
      fail({
        ctx,
        path: `${path}.fromNodeId`,
        message: `node "${fromNodeId}" already has the action ${describeAction({ action: existing })}, so this transition would give it two different actions`,
      });
      return;
    }
    ctx.inlineActions.set(fromNodeId, action);
    transitions.push({ fromNodeId, toScreenId, label });
  });
  return transitions;
};

const parseMockState = ({
  ctx,
  value,
}: {
  readonly ctx: Ctx;
  readonly value: unknown;
}): Readonly<Record<string, boolean>> => {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    fail({ ctx, path: 'mockState', message: 'expected an object of boolean flags' });
    return {};
  }
  const keys = Object.keys(value);
  if (keys.length > WIREFRAME_LIMITS.maxMockStateKeys) {
    fail({
      ctx,
      path: 'mockState',
      message: `more than the ${WIREFRAME_LIMITS.maxMockStateKeys} mock state limit`,
    });
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const key of keys) {
    if (identifier({ ctx, path: `mockState.${key}`, value: key }) === null) {
      continue;
    }
    if (typeof value[key] !== 'boolean') {
      fail({ ctx, path: `mockState.${key}`, message: 'expected a boolean' });
      continue;
    }
    out[key] = value[key] === true;
  }
  return out;
};

const fieldOf = ({ path }: { readonly path: string }): string => {
  const segments = path.split('.');
  return segments[segments.length - 1] ?? path;
};

type AdjustmentGroup = {
  readonly change: WireframeAdjustmentChange;
  readonly path: string;
  readonly message: string;
  count: number;
};

const groupAdjustments = ({
  adjustments,
}: {
  readonly adjustments: ReadonlyArray<RawAdjustment>;
}): ReadonlyArray<AdjustmentGroup> => {
  const groups = new Map<string, AdjustmentGroup>();
  for (const entry of adjustments) {
    const key = [entry.change, fieldOf({ path: entry.path }), entry.message].join('\u0000');
    const seen = groups.get(key);
    if (seen === undefined) {
      groups.set(key, {
        change: entry.change,
        path: entry.path,
        message: entry.message,
        count: 1,
      });
      continue;
    }
    seen.count += 1;
  }
  return [...groups.values()];
};

const reportedAdjustments = ({
  adjustments,
}: {
  readonly adjustments: ReadonlyArray<RawAdjustment>;
}): ReadonlyArray<WireframeAdjustment> => {
  const groups = groupAdjustments({ adjustments });
  const shown = groups
    .slice(0, MAX_WIREFRAME_ADJUSTMENTS)
    .map(({ change, path, message, count }) => ({ change, path, message, count }));
  const hidden = groups.slice(MAX_WIREFRAME_ADJUSTMENTS);
  if (hidden.length === 0) {
    return shown;
  }
  const countHidden = ({ change }: { readonly change: WireframeAdjustmentChange }): number =>
    hidden.filter((group) => group.change === change).length;
  return [
    ...shown,
    {
      change: 'hidden',
      moved: countHidden({ change: 'moved' }),
      clipped: countHidden({ change: 'clipped' }),
      dropped: countHidden({ change: 'dropped' }),
    },
  ];
};

export const validateWireframeDocument = ({
  value,
}: {
  readonly value: unknown;
}): WireframeValidationResult => {
  const ctx: Ctx = {
    issues: [],
    adjustments: [],
    nodeCount: 0,
    nodeIds: new Set<string>(),
    interactiveNodeIds: new Set<string>(),
    inlineActions: new Map<string, WireframeAction>(),
    actionRefs: { screenIds: [], stateKeys: [] },
  };
  if (!isRecord(value)) {
    return { status: 'invalid', issues: [{ path: '', message: 'expected a wireframe object' }] };
  }
  dropUnknownKeys({
    ctx,
    path: '',
    value,
    allowed: ['version', 'initialScreenId', 'theme', 'screens', 'transitions', 'mockState'],
  });
  const version = value['version'];
  if (version !== WIREFRAME_SCHEMA_VERSION) {
    ctx.issues.push({
      path: 'version',
      message: `expected version ${WIREFRAME_SCHEMA_VERSION}`,
    });
  }
  const theme = parseTheme({ ctx, value: value['theme'] });
  const screens = parseScreens({ ctx, value: value['screens'] });
  const screenIds = new Set(screens.map((screen) => screen.id));
  const transitions = parseTransitions({ ctx, value: value['transitions'], screenIds });
  const mockState = parseMockState({ ctx, value: value['mockState'] });
  const initialScreenId = identifier({
    ctx,
    path: 'initialScreenId',
    value: value['initialScreenId'],
  });
  if (initialScreenId !== null && !screenIds.has(initialScreenId)) {
    ctx.issues.push({
      path: 'initialScreenId',
      message: `no screen with id "${initialScreenId}"`,
    });
  }
  for (const target of ctx.actionRefs.screenIds) {
    if (!screenIds.has(target)) {
      ctx.issues.push({
        path: 'screens',
        message: `an action navigates to the undeclared screen "${target}"`,
      });
    }
  }
  for (const key of ctx.actionRefs.stateKeys) {
    if (!Object.prototype.hasOwnProperty.call(mockState, key)) {
      ctx.issues.push({
        path: 'mockState',
        message: `an action toggles the undeclared mock state "${key}"`,
      });
    }
  }
  if (ctx.issues.length > 0 || initialScreenId === null) {
    return { status: 'invalid', issues: ctx.issues };
  }
  return {
    status: 'valid',
    document: {
      version: WIREFRAME_SCHEMA_VERSION,
      initialScreenId,
      theme,
      screens,
      transitions,
      ...(Object.keys(mockState).length > 0 && { mockState }),
    },
    adjustments: reportedAdjustments({ adjustments: ctx.adjustments }),
  };
};

export const parseWireframeSource = ({
  source,
}: {
  readonly source: string;
}): WireframeValidationResult => {
  try {
    return validateWireframeDocument({ value: JSON.parse(source) as unknown });
  } catch {
    return { status: 'invalid', issues: [{ path: '', message: 'the source is not valid JSON' }] };
  }
};
