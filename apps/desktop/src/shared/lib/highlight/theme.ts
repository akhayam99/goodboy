import type { ThemeRegistration } from 'shiki/core';
import type { CodeLines, CodeToken, CodeTokenKind } from '@goodboy/ui';

export type SyntaxKind = CodeTokenKind;

export type SyntaxToken = CodeToken;

export type SyntaxLines = CodeLines;

const SENTINEL: Record<SyntaxKind, string> = {
  plain: '#000000',
  keyword: '#000001',
  string: '#000002',
  number: '#000003',
  comment: '#000004',
  function: '#000005',
  type: '#000006',
  constant: '#000007',
  property: '#000008',
  operator: '#000009',
  punctuation: '#00000a',
  tag: '#00000b',
  regex: '#00000c',
};

const KIND_BY_SENTINEL = new Map<string, SyntaxKind>(
  (Object.entries(SENTINEL) as ReadonlyArray<[SyntaxKind, string]>).map(([kind, color]) => [
    color,
    kind,
  ]),
);

export const kindForColor = (color: string | undefined): SyntaxKind =>
  (color && KIND_BY_SENTINEL.get(color.toLowerCase().slice(0, 7))) || 'plain';

const SCOPES: ReadonlyArray<readonly [SyntaxKind, ReadonlyArray<string>]> = [
  ['comment', ['comment', 'punctuation.definition.comment', 'string.comment']],
  [
    'string',
    [
      'string',
      'punctuation.definition.string',
      'constant.other.symbol',
      'markup.inline.raw',
      'markup.inserted',
      'punctuation.definition.inserted',
    ],
  ],
  ['regex', ['string.regexp', 'constant.other.character-class.regexp']],
  ['number', ['constant.numeric', 'keyword.other.unit']],
  [
    'constant',
    [
      'constant',
      'constant.language',
      'constant.character',
      'constant.other',
      'support.constant',
      'variable.language',
      'variable.other.constant',
      'variable.other.enummember',
    ],
  ],
  [
    'keyword',
    [
      'keyword',
      'keyword.control',
      'keyword.other',
      'storage',
      'storage.type',
      'storage.modifier',
      'keyword.operator.new',
      'keyword.operator.expression',
      'keyword.operator.logical.python',
      'punctuation.definition.template-expression',
      'punctuation.section.embedded',
    ],
  ],
  ['operator', ['keyword.operator', 'punctuation.accessor', 'punctuation.separator.key-value']],
  [
    'function',
    [
      'entity.name.function',
      'support.function',
      'meta.function-call entity.name.function',
      'variable.function',
      'meta.diff.range',
      'meta.diff.header',
    ],
  ],
  [
    'type',
    [
      'entity.name.type',
      'entity.name.class',
      'entity.name.namespace',
      'entity.other.inherited-class',
      'support.type',
      'support.class',
      'storage.type.primitive',
      'storage.type.built-in',
      'storage.type.numeric',
      'storage.type.string',
      'storage.type.boolean',
    ],
  ],
  [
    'property',
    [
      'variable.other.property',
      'variable.other.object.property',
      'meta.object-literal.key',
      'support.type.property-name',
      'entity.other.attribute-name',
      'entity.name.tag.yaml',
      'support.variable.property',
    ],
  ],
  ['punctuation', ['punctuation', 'meta.brace', 'punctuation.definition.tag']],
  [
    'tag',
    [
      'entity.name.tag',
      'markup.heading',
      'entity.name.section',
      'markup.deleted',
      'punctuation.definition.deleted',
      'entity.other.attribute-name.class.css',
      'entity.other.attribute-name.id.css',
    ],
  ],
];

export const SENTINEL_THEME: ThemeRegistration = {
  name: 'goodboy-sentinel',
  type: 'dark',
  fg: SENTINEL.plain,
  bg: '#ffffff',
  settings: [
    { settings: { foreground: SENTINEL.plain, background: '#ffffff' } },
    ...SCOPES.map(([kind, scope]) => ({
      scope: [...scope],
      settings: { foreground: SENTINEL[kind] },
    })),
  ],
};
