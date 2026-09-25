import { createContext } from 'react';

export type CodeTokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'type'
  | 'constant'
  | 'property'
  | 'operator'
  | 'punctuation'
  | 'tag'
  | 'regex'
  | 'plain';

export type CodeToken = {
  readonly text: string;
  readonly kind: CodeTokenKind;
};

export type CodeLines = ReadonlyArray<ReadonlyArray<CodeToken>>;

export type CodeHighlighter = {
  readonly highlight: (code: string, lang: string) => Promise<CodeLines | null>;
  readonly peek: (code: string, lang: string) => CodeLines | null | undefined;
};

export const CODE_TOKEN_CLASS: Record<CodeTokenKind, string> = {
  keyword: 'text-syntax-keyword',
  string: 'text-syntax-string',
  number: 'text-syntax-number',
  comment: 'text-syntax-comment italic',
  function: 'text-syntax-function',
  type: 'text-syntax-type',
  constant: 'text-syntax-constant',
  property: 'text-syntax-property',
  operator: 'text-syntax-operator',
  punctuation: 'text-syntax-punctuation',
  tag: 'text-syntax-tag',
  regex: 'text-syntax-regex',
  plain: '',
};

export const CodeHighlighterContext = createContext<CodeHighlighter | null>(null);
