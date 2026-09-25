import {
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
  type WireframeNodeKind,
} from './schema';

export const WIREFRAME_JSON_SCHEMA_ID = 'urn:goodboy:wireframe:v1';

type JsonSchema = Readonly<Record<string, unknown>>;

const ID = {
  type: 'string',
  pattern: `^[a-zA-Z][a-zA-Z0-9_-]{0,${WIREFRAME_LIMITS.maxIdLength - 1}}$`,
} as const satisfies JsonSchema;

const TEXT = {
  type: 'string',
  minLength: 1,
  maxLength: WIREFRAME_LIMITS.maxTextLength,
} as const satisfies JsonSchema;

const enumOf = (values: ReadonlyArray<string>): JsonSchema => ({
  type: 'string',
  enum: [...values],
});

const REF_ACTION = { $ref: '#/$defs/action' } as const satisfies JsonSchema;

const REF_NODE = { $ref: '#/$defs/node' } as const satisfies JsonSchema;

type NodeSchemaParams = {
  readonly kind: WireframeNodeKind;
  readonly required: ReadonlyArray<string>;
  readonly properties: JsonSchema;
};

const nodeSchema = ({ kind, required, properties }: NodeSchemaParams): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  required: ['id', 'kind', ...required],
  properties: {
    id: ID,
    kind: { const: kind },
    note: TEXT,
    ...properties,
  },
});

const CHILDREN = {
  type: 'array',
  items: REF_NODE,
} as const satisfies JsonSchema;

const NODE_SCHEMAS = {
  stack: nodeSchema({
    kind: 'stack',
    required: ['direction', 'children'],
    properties: {
      direction: enumOf(WIREFRAME_DIRECTIONS),
      gap: enumOf(WIREFRAME_SPACINGS),
      padding: enumOf(WIREFRAME_SPACINGS),
      align: enumOf(WIREFRAME_ALIGNMENTS),
      justify: enumOf(WIREFRAME_JUSTIFICATIONS),
      surface: { type: 'boolean' },
      children: CHILDREN,
    },
  }),
  grid: nodeSchema({
    kind: 'grid',
    required: ['columns', 'children'],
    properties: {
      columns: { type: 'integer', minimum: 1, maximum: WIREFRAME_LIMITS.maxGridColumns },
      gap: enumOf(WIREFRAME_SPACINGS),
      padding: enumOf(WIREFRAME_SPACINGS),
      children: CHILDREN,
    },
  }),
  text: nodeSchema({
    kind: 'text',
    required: ['text'],
    properties: { text: TEXT, variant: enumOf(WIREFRAME_TEXT_VARIANTS) },
  }),
  button: nodeSchema({
    kind: 'button',
    required: ['label'],
    properties: {
      label: TEXT,
      variant: enumOf(WIREFRAME_BUTTON_VARIANTS),
      action: REF_ACTION,
    },
  }),
  input: nodeSchema({
    kind: 'input',
    required: ['inputType'],
    properties: {
      inputType: enumOf(WIREFRAME_INPUT_TYPES),
      label: TEXT,
      placeholder: TEXT,
      options: { type: 'array', items: TEXT, maxItems: WIREFRAME_LIMITS.maxSelectOptions },
    },
  }),
  list: nodeSchema({
    kind: 'list',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        maxItems: WIREFRAME_LIMITS.maxListItems,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title'],
          properties: { id: ID, title: TEXT, subtitle: TEXT, action: REF_ACTION },
        },
      },
    },
  }),
  table: nodeSchema({
    kind: 'table',
    required: ['columns', 'rows'],
    properties: {
      columns: {
        type: 'array',
        minItems: 1,
        maxItems: WIREFRAME_LIMITS.maxTableColumns,
        items: TEXT,
      },
      rows: {
        type: 'array',
        maxItems: WIREFRAME_LIMITS.maxTableRows,
        items: { type: 'array', maxItems: WIREFRAME_LIMITS.maxTableColumns, items: TEXT },
      },
    },
  }),
  image: nodeSchema({
    kind: 'image',
    required: ['alt'],
    properties: { alt: TEXT, ratio: enumOf(WIREFRAME_IMAGE_RATIOS) },
  }),
  navigation: nodeSchema({
    kind: 'navigation',
    required: ['variant', 'items'],
    properties: {
      variant: enumOf(WIREFRAME_NAVIGATION_VARIANTS),
      items: {
        type: 'array',
        maxItems: WIREFRAME_LIMITS.maxNavigationItems,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label'],
          properties: { id: ID, label: TEXT, isActive: { type: 'boolean' }, action: REF_ACTION },
        },
      },
    },
  }),
} as const satisfies Record<WireframeNodeKind, JsonSchema>;

const nodeDefs = (): JsonSchema =>
  Object.fromEntries(WIREFRAME_NODE_KINDS.map((kind) => [`${kind}Node`, NODE_SCHEMAS[kind]]));

export const buildWireframeJsonSchema = (): JsonSchema => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: WIREFRAME_JSON_SCHEMA_ID,
  title: 'Goodboy wireframe',
  description: `A wireframe document, version ${WIREFRAME_SCHEMA_VERSION}. Beyond what this schema checks, a document holds at most ${WIREFRAME_LIMITS.maxNodes} nodes, nests at most ${WIREFRAME_LIMITS.maxDepth} levels deep, uses each id once, and every navigate action and transition points to a screen of the document.`,
  type: 'object',
  additionalProperties: false,
  required: ['version', 'initialScreenId', 'theme', 'screens', 'transitions'],
  properties: {
    $schema: { type: 'string' },
    version: { const: WIREFRAME_SCHEMA_VERSION },
    initialScreenId: ID,
    theme: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: TEXT,
        font: enumOf(WIREFRAME_THEME_FONTS),
        radius: enumOf(WIREFRAME_THEME_RADII),
        colors: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            WIREFRAME_THEME_COLOR_TOKENS.map((token) => [
              token,
              { type: 'string', pattern: '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' },
            ]),
          ),
        },
        sources: { type: 'array', items: TEXT },
      },
    },
    screens: {
      type: 'array',
      minItems: 1,
      maxItems: WIREFRAME_LIMITS.maxScreens,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'viewport', 'root'],
        properties: {
          id: ID,
          title: TEXT,
          viewport: enumOf(WIREFRAME_VIEWPORTS),
          root: REF_NODE,
          note: TEXT,
        },
      },
    },
    transitions: {
      type: 'array',
      maxItems: WIREFRAME_LIMITS.maxTransitions,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fromNodeId', 'toScreenId', 'label'],
        properties: { fromNodeId: ID, toScreenId: ID, label: TEXT },
      },
    },
    mockState: {
      type: 'object',
      maxProperties: WIREFRAME_LIMITS.maxMockStateKeys,
      additionalProperties: { type: 'boolean' },
    },
  },
  $defs: {
    action: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'toScreenId'],
          properties: { type: { const: 'navigate' }, toScreenId: ID },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'stateKey'],
          properties: { type: { const: 'toggle' }, stateKey: ID },
        },
      ],
    },
    node: {
      oneOf: WIREFRAME_NODE_KINDS.map((kind) => ({ $ref: `#/$defs/${kind}Node` })),
    },
    ...nodeDefs(),
  },
});
