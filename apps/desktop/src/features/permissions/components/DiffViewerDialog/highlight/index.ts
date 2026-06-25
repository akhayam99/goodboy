export type SyntaxKind =
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
  | 'plain'

export type SyntaxToken = {
  readonly text: string
  readonly kind: SyntaxKind
}

export type SyntaxLang =
  | 'ts'
  | 'js'
  | 'json'
  | 'css'
  | 'rust'
  | 'python'
  | 'go'
  | 'shell'
  | 'markdown'
  | 'yaml'
  | 'toml'
  | 'html'

export const SYNTAX_CLASS: Record<SyntaxKind, string> = {
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
}

const EXT_LANG: Record<string, SyntaxLang> = {
  ts: 'ts',
  mts: 'ts',
  cts: 'ts',
  tsx: 'ts',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'js',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  rs: 'rust',
  py: 'python',
  go: 'go',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  md: 'markdown',
  mdx: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  html: 'html',
  htm: 'html',
  xml: 'html',
  svg: 'html',
}

export const languageForPath = (path: string): SyntaxLang | null => {
  const match = /\.([a-z0-9]+)$/i.exec(path)
  if (!match) {
    return null
  }
  return EXT_LANG[match[1]!.toLowerCase()] ?? null
}

type Scanner = {
  readonly text: string
  pos: number
  readonly tokens: SyntaxToken[]
}

const makeScanner = (text: string): Scanner => ({ text, pos: 0, tokens: [] })

const push = (scanner: Scanner, length: number, kind: SyntaxKind): void => {
  if (length <= 0) {
    return
  }
  const slice = scanner.text.slice(scanner.pos, scanner.pos + length)
  if (slice.length === 0) {
    return
  }
  const last = scanner.tokens[scanner.tokens.length - 1]
  if (last && last.kind === kind && kind === 'plain') {
    scanner.tokens[scanner.tokens.length - 1] = {
      text: last.text + slice,
      kind,
    }
  } else {
    scanner.tokens.push({ text: slice, kind })
  }
  scanner.pos += length
}

const peek = (scanner: Scanner, offset = 0): string => scanner.text[scanner.pos + offset] ?? ''

const matchAt = (scanner: Scanner, re: RegExp): RegExpExecArray | null => {
  re.lastIndex = scanner.pos
  const result = re.exec(scanner.text)
  if (result && result.index === scanner.pos) {
    return result
  }
  return null
}

const isWordChar = (ch: string): boolean => /[A-Za-z0-9_$]/.test(ch)

const isCapitalized = (word: string): boolean => /^[A-Z]/.test(word)

const WHITESPACE = /[ \t\f\v]+/y

const consumeWhitespace = (scanner: Scanner): boolean => {
  const m = matchAt(scanner, WHITESPACE)
  if (m) {
    push(scanner, m[0].length, 'plain')
    return true
  }
  return false
}

const scanString = (scanner: Scanner, quote: string): void => {
  let length = 1
  while (scanner.pos + length < scanner.text.length) {
    const ch = scanner.text[scanner.pos + length]!
    if (ch === '\\') {
      length += 2
      continue
    }
    length += 1
    if (ch === quote) {
      break
    }
  }
  push(scanner, length, 'string')
}

const scanBlockComment = (scanner: Scanner): boolean => {
  if (peek(scanner) === '/' && peek(scanner, 1) === '*') {
    const end = scanner.text.indexOf('*/', scanner.pos + 2)
    const length = end === -1 ? scanner.text.length - scanner.pos : end + 2 - scanner.pos
    push(scanner, length, 'comment')
    return true
  }
  return false
}

const JS_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
  'await',
  'async',
  'of',
  'from',
  'as',
  'get',
  'set',
])

const TS_KEYWORDS = new Set([
  'type',
  'interface',
  'enum',
  'implements',
  'readonly',
  'declare',
  'namespace',
  'abstract',
  'public',
  'private',
  'protected',
  'keyof',
  'infer',
  'is',
  'satisfies',
  'override',
  'module',
  'asserts',
  'unique',
])

const JS_CONSTANTS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'])

const JS_TYPE_KEYWORDS = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'symbol',
  'bigint',
  'any',
  'unknown',
  'never',
  'void',
])

const NUMBER_JS =
  /0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?n?/y

const IDENT_JS = /[A-Za-z_$][A-Za-z0-9_$]*/y

const JS_OPERATOR = /[+\-*/%=<>!&|^~?]+/y

const scanJsFamily = (scanner: Scanner, ts: boolean): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)

    if (ch === '/' && peek(scanner, 1) === '/') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    if (scanBlockComment(scanner)) {
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      scanString(scanner, ch)
      continue
    }
    if (ch === '<') {
      const tagMatch = matchAt(scanner, /<\/?([A-Za-z][A-Za-z0-9]*)/y)
      if (tagMatch) {
        const close = tagMatch[0].indexOf('/') === 1 ? 2 : 1
        push(scanner, close, 'punctuation')
        push(scanner, tagMatch[1]!.length, 'tag')
        continue
      }
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(peek(scanner, 1)))) {
      const m = matchAt(scanner, NUMBER_JS)
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (isWordChar(ch) && /[A-Za-z_$]/.test(ch)) {
      const m = matchAt(scanner, IDENT_JS)
      const word = m![0]
      const prevToken = lastNonSpace(scanner)
      const afterDot = prevToken === '.'
      let kind: SyntaxKind = 'plain'
      if (afterDot) {
        kind = nextIsCall(scanner, word.length) ? 'function' : 'property'
      } else if (JS_CONSTANTS.has(word)) {
        kind = 'constant'
      } else if (ts && (JS_KEYWORDS.has(word) || TS_KEYWORDS.has(word))) {
        kind = 'keyword'
      } else if (!ts && JS_KEYWORDS.has(word)) {
        kind = 'keyword'
      } else if (ts && JS_TYPE_KEYWORDS.has(word)) {
        kind = 'type'
      } else if (nextIsCall(scanner, word.length)) {
        kind = 'function'
      } else if (isCapitalized(word)) {
        kind = 'type'
      }
      push(scanner, word.length, kind)
      continue
    }
    if ('{}()[];,.:'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    const op = matchAt(scanner, JS_OPERATOR)
    if (op) {
      push(scanner, op[0].length, 'operator')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const lastNonSpace = (scanner: Scanner): string => {
  for (let i = scanner.tokens.length - 1; i >= 0; i -= 1) {
    const trimmed = scanner.tokens[i]!.text.trim()
    if (trimmed.length > 0) {
      return trimmed[trimmed.length - 1]!
    }
  }
  return ''
}

const nextIsCall = (scanner: Scanner, wordLength: number): boolean => {
  let i = scanner.pos + wordLength
  while (i < scanner.text.length && /[ \t]/.test(scanner.text[i]!)) {
    i += 1
  }
  return scanner.text[i] === '('
}

const scanJson = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '"') {
      scanString(scanner, '"')
      let i = scanner.pos
      while (i < scanner.text.length && /[ \t]/.test(scanner.text[i]!)) {
        i += 1
      }
      const isKey = scanner.text[i] === ':'
      const tok = scanner.tokens[scanner.tokens.length - 1]!
      scanner.tokens[scanner.tokens.length - 1] = {
        text: tok.text,
        kind: isKey ? 'property' : 'string',
      }
      continue
    }
    if (/[0-9-]/.test(ch)) {
      const m = matchAt(scanner, /-?(?:\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?/y)
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    const word = matchAt(scanner, /[A-Za-z]+/y)
    if (word && (word[0] === 'true' || word[0] === 'false' || word[0] === 'null')) {
      push(scanner, word[0].length, 'constant')
      continue
    }
    if (word) {
      push(scanner, word[0].length, 'plain')
      continue
    }
    if ('{}[]:,'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const scanCss = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (scanBlockComment(scanner)) {
      continue
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    if (ch === '@') {
      const m = matchAt(scanner, /@[A-Za-z-]+/y)
      if (m) {
        push(scanner, m[0].length, 'keyword')
        continue
      }
    }
    if (ch === '#') {
      const m = matchAt(scanner, /#[A-Za-z0-9_-]+/y)
      if (m) {
        push(scanner, m[0].length, 'constant')
        continue
      }
    }
    if (ch === '.') {
      const m = matchAt(scanner, /\.[A-Za-z_-][A-Za-z0-9_-]*/y)
      if (m) {
        push(scanner, m[0].length, 'type')
        continue
      }
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9.]/.test(peek(scanner, 1)))) {
      const m = matchAt(scanner, /-?(?:\d*\.\d+|\d+)(?:%|[a-zA-Z]+)?/y)
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z_-]/.test(ch)) {
      const m = matchAt(scanner, /-?[A-Za-z_-][A-Za-z0-9_-]*/y)
      const word = m![0]
      let j = scanner.pos + word.length
      while (j < scanner.text.length && /[ \t]/.test(scanner.text[j]!)) {
        j += 1
      }
      const isProperty = scanner.text[j] === ':'
      push(scanner, word.length, isProperty ? 'property' : 'plain')
      continue
    }
    if ('{}();:,'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const RUST_KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'const',
  'continue',
  'crate',
  'dyn',
  'else',
  'enum',
  'extern',
  'false',
  'fn',
  'for',
  'if',
  'impl',
  'in',
  'let',
  'loop',
  'match',
  'mod',
  'move',
  'mut',
  'pub',
  'ref',
  'return',
  'self',
  'Self',
  'static',
  'struct',
  'super',
  'trait',
  'true',
  'type',
  'unsafe',
  'use',
  'where',
  'while',
])

const RUST_CONSTANTS = new Set(['true', 'false', 'None', 'Some', 'Ok', 'Err'])

const scanRust = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '/' && peek(scanner, 1) === '/') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    if (scanBlockComment(scanner)) {
      continue
    }
    if (ch === '"') {
      scanString(scanner, '"')
      continue
    }
    if (ch === "'") {
      const charLit = matchAt(scanner, /'(?:\\.|[^'\\])'/y)
      if (charLit) {
        push(scanner, charLit[0].length, 'string')
        continue
      }
    }
    if (/[0-9]/.test(ch)) {
      const m = matchAt(
        scanner,
        /0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:[iuf]\d+|usize|isize)?/y,
      )
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = matchAt(scanner, /[A-Za-z_][A-Za-z0-9_]*/y)
      const word = m![0]
      const isMacro = scanner.text[scanner.pos + word.length] === '!'
      let kind: SyntaxKind = 'plain'
      if (RUST_CONSTANTS.has(word)) {
        kind = 'constant'
      } else if (RUST_KEYWORDS.has(word)) {
        kind = 'keyword'
      } else if (isMacro) {
        push(scanner, word.length, 'function')
        push(scanner, 1, 'operator')
        continue
      } else if (nextIsCall(scanner, word.length)) {
        kind = 'function'
      } else if (isCapitalized(word)) {
        kind = 'type'
      }
      push(scanner, word.length, kind)
      continue
    }
    if ('{}()[];,.:'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    const op = matchAt(scanner, /[+\-*/%=<>!&|^~?@]+/y)
    if (op) {
      push(scanner, op[0].length, 'operator')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const PYTHON_KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
  'match',
  'case',
])

const PYTHON_CONSTANTS = new Set(['True', 'False', 'None'])

const scanPython = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '#') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    const triple = matchAt(scanner, /[rbfu]*("""|''')/y)
    if (triple) {
      const quote = triple[1]!
      const end = scanner.text.indexOf(quote, scanner.pos + triple[0].length)
      const length =
        end === -1 ? scanner.text.length - scanner.pos : end + quote.length - scanner.pos
      push(scanner, length, 'string')
      continue
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    const prefix = matchAt(scanner, /[rbfu]+(?=["'])/iy)
    if (prefix) {
      push(scanner, prefix[0].length, 'plain')
      const q = peek(scanner)
      scanString(scanner, q)
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(peek(scanner, 1)))) {
      const m = matchAt(
        scanner,
        /0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?j?/y,
      )
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = matchAt(scanner, /[A-Za-z_][A-Za-z0-9_]*/y)
      const word = m![0]
      let kind: SyntaxKind = 'plain'
      if (PYTHON_CONSTANTS.has(word)) {
        kind = 'constant'
      } else if (PYTHON_KEYWORDS.has(word)) {
        kind = 'keyword'
      } else if (nextIsCall(scanner, word.length)) {
        kind = 'function'
      } else if (isCapitalized(word)) {
        kind = 'type'
      }
      push(scanner, word.length, kind)
      continue
    }
    if ('{}()[];,.:'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    const op = matchAt(scanner, /[+\-*/%=<>!&|^~@]+/y)
    if (op) {
      push(scanner, op[0].length, 'operator')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const GO_KEYWORDS = new Set([
  'break',
  'case',
  'chan',
  'const',
  'continue',
  'default',
  'defer',
  'else',
  'fallthrough',
  'for',
  'func',
  'go',
  'goto',
  'if',
  'import',
  'interface',
  'map',
  'package',
  'range',
  'return',
  'select',
  'struct',
  'switch',
  'type',
  'var',
])

const GO_CONSTANTS = new Set(['true', 'false', 'nil', 'iota'])

const scanGo = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '/' && peek(scanner, 1) === '/') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    if (scanBlockComment(scanner)) {
      continue
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    if (ch === '`') {
      const end = scanner.text.indexOf('`', scanner.pos + 1)
      const length = end === -1 ? scanner.text.length - scanner.pos : end + 1 - scanner.pos
      push(scanner, length, 'string')
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(peek(scanner, 1)))) {
      const m = matchAt(
        scanner,
        /0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?i?/y,
      )
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = matchAt(scanner, /[A-Za-z_][A-Za-z0-9_]*/y)
      const word = m![0]
      let kind: SyntaxKind = 'plain'
      if (GO_CONSTANTS.has(word)) {
        kind = 'constant'
      } else if (GO_KEYWORDS.has(word)) {
        kind = 'keyword'
      } else if (nextIsCall(scanner, word.length)) {
        kind = 'function'
      } else if (isCapitalized(word)) {
        kind = 'type'
      }
      push(scanner, word.length, kind)
      continue
    }
    if ('{}()[];,.:'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    const op = matchAt(scanner, /[+\-*/%=<>!&|^~]+/y)
    if (op) {
      push(scanner, op[0].length, 'operator')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const SHELL_KEYWORDS = new Set([
  'if',
  'then',
  'fi',
  'else',
  'elif',
  'for',
  'while',
  'do',
  'done',
  'case',
  'esac',
  'function',
  'in',
  'select',
  'until',
  'return',
  'local',
  'export',
  'readonly',
  'declare',
])

const scanShell = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '#') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    if (ch === '$') {
      const m = matchAt(scanner, /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[@*#?$!0-9-]/y)
      if (m) {
        push(scanner, m[0].length, 'property')
        continue
      }
    }
    if (/[0-9]/.test(ch)) {
      const m = matchAt(scanner, /\d+/y)
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = matchAt(scanner, /[A-Za-z_][A-Za-z0-9_]*/y)
      const word = m![0]
      push(scanner, word.length, SHELL_KEYWORDS.has(word) ? 'keyword' : 'plain')
      continue
    }
    if ('{}()[];,'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    const op = matchAt(scanner, /[|&<>=!]+/y)
    if (op) {
      push(scanner, op[0].length, 'operator')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const scanMarkdown = (scanner: Scanner): SyntaxToken[] => {
  const heading = matchAt(scanner, /\s*#{1,6}\s/y)
  if (heading) {
    push(scanner, heading[0].length, 'keyword')
  } else {
    const listMarker = matchAt(scanner, /\s*(?:[-*+]|\d+\.)\s/y)
    if (listMarker) {
      push(scanner, listMarker[0].length, 'punctuation')
    }
  }
  while (scanner.pos < scanner.text.length) {
    const ch = peek(scanner)
    if (ch === '`') {
      const end = scanner.text.indexOf('`', scanner.pos + 1)
      if (end !== -1) {
        push(scanner, end + 1 - scanner.pos, 'string')
        continue
      }
    }
    if (ch === '*' || ch === '_') {
      const m = matchAt(scanner, /\*\*|__|\*|_/y)
      if (m) {
        push(scanner, m[0].length, 'punctuation')
        continue
      }
    }
    if (ch === '[') {
      const m = matchAt(scanner, /\[[^\]]*\]\([^)]*\)/y)
      if (m) {
        const close = m[0].indexOf(']')
        push(scanner, 1, 'punctuation')
        push(scanner, close - 1, 'string')
        push(scanner, m[0].length - close, 'plain')
        continue
      }
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const YAML_CONSTANTS = new Set([
  'true',
  'false',
  'null',
  'yes',
  'no',
  'on',
  'off',
  'True',
  'False',
  'Null',
  'Yes',
  'No',
  '~',
])

const scanYaml = (scanner: Scanner): SyntaxToken[] => {
  const listMarker = matchAt(scanner, /\s*-\s/y)
  if (listMarker) {
    const dash = listMarker[0].indexOf('-')
    push(scanner, dash, 'plain')
    push(scanner, 1, 'punctuation')
    push(scanner, listMarker[0].length - dash - 1, 'plain')
  } else {
    consumeWhitespace(scanner)
  }
  const key = matchAt(scanner, /[A-Za-z_][A-Za-z0-9_-]*(?=\s*:(?:\s|$))/y)
  if (key) {
    push(scanner, key[0].length, 'property')
  }
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '#') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    if (ch === ':') {
      push(scanner, 1, 'punctuation')
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(peek(scanner, 1)))) {
      const m = matchAt(scanner, /-?(?:\d+)(?:\.\d+)?/y)
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z~]/.test(ch)) {
      const m = matchAt(scanner, /[A-Za-z~][A-Za-z0-9_-]*/y)
      const word = m![0]
      push(scanner, word.length, YAML_CONSTANTS.has(word) ? 'constant' : 'plain')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const TOML_CONSTANTS = new Set(['true', 'false'])

const scanToml = (scanner: Scanner): SyntaxToken[] => {
  consumeWhitespace(scanner)
  const section = matchAt(scanner, /\[\[?[^\]]*\]\]?/y)
  if (section) {
    push(scanner, section[0].length, 'type')
  }
  const key = matchAt(scanner, /[A-Za-z_][A-Za-z0-9_-]*(?=\s*=)/y)
  if (key) {
    push(scanner, key[0].length, 'property')
  }
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '#') {
      push(scanner, scanner.text.length - scanner.pos, 'comment')
      continue
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    if (ch === '=') {
      push(scanner, 1, 'operator')
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(peek(scanner, 1)))) {
      const m = matchAt(scanner, /-?(?:\d[\d_]*)(?:\.\d[\d_]*)?/y)
      if (m && m[0].length > 0) {
        push(scanner, m[0].length, 'number')
        continue
      }
    }
    if (/[A-Za-z]/.test(ch)) {
      const m = matchAt(scanner, /[A-Za-z][A-Za-z0-9_-]*/y)
      const word = m![0]
      push(scanner, word.length, TOML_CONSTANTS.has(word) ? 'constant' : 'plain')
      continue
    }
    if ('[],{}.'.includes(ch)) {
      push(scanner, 1, 'punctuation')
      continue
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const scanHtml = (scanner: Scanner): SyntaxToken[] => {
  while (scanner.pos < scanner.text.length) {
    const ch = peek(scanner)
    if (ch === '<' && scanner.text.startsWith('<!--', scanner.pos)) {
      const end = scanner.text.indexOf('-->', scanner.pos + 4)
      const length = end === -1 ? scanner.text.length - scanner.pos : end + 3 - scanner.pos
      push(scanner, length, 'comment')
      continue
    }
    if (ch === '<') {
      const open = matchAt(scanner, /<\/?[A-Za-z][A-Za-z0-9-]*/y)
      if (open) {
        const slash = open[0][1] === '/' ? 2 : 1
        push(scanner, slash, 'punctuation')
        push(scanner, open[0].length - slash, 'tag')
        scanHtmlAttrs(scanner)
        continue
      }
      const closeBang = matchAt(scanner, /<!?[^>]*>/y)
      if (closeBang) {
        push(scanner, closeBang[0].length, 'punctuation')
        continue
      }
    }
    push(scanner, 1, 'plain')
  }
  return scanner.tokens
}

const scanHtmlAttrs = (scanner: Scanner): void => {
  while (scanner.pos < scanner.text.length) {
    if (consumeWhitespace(scanner)) {
      continue
    }
    const ch = peek(scanner)
    if (ch === '>') {
      push(scanner, 1, 'punctuation')
      return
    }
    if (ch === '/' && peek(scanner, 1) === '>') {
      push(scanner, 2, 'punctuation')
      return
    }
    if (ch === '"' || ch === "'") {
      scanString(scanner, ch)
      continue
    }
    if (ch === '=') {
      push(scanner, 1, 'operator')
      continue
    }
    const attr = matchAt(scanner, /[A-Za-z_:][A-Za-z0-9_:.-]*/y)
    if (attr) {
      push(scanner, attr[0].length, 'property')
      continue
    }
    push(scanner, 1, 'plain')
  }
}

const verifyLossless = (text: string, tokens: SyntaxToken[]): SyntaxToken[] => {
  let joined = ''
  for (const token of tokens) {
    joined += token.text
  }
  if (joined !== text) {
    return [{ text, kind: 'plain' }]
  }
  return tokens
}

export const highlightLine = (
  text: string,
  lang: SyntaxLang | null,
): ReadonlyArray<SyntaxToken> => {
  if (text.length === 0) {
    return []
  }
  if (lang === null) {
    return [{ text, kind: 'plain' }]
  }
  const scanner = makeScanner(text)
  let tokens: SyntaxToken[]
  switch (lang) {
    case 'ts':
      tokens = scanJsFamily(scanner, true)
      break
    case 'js':
      tokens = scanJsFamily(scanner, false)
      break
    case 'json':
      tokens = scanJson(scanner)
      break
    case 'css':
      tokens = scanCss(scanner)
      break
    case 'rust':
      tokens = scanRust(scanner)
      break
    case 'python':
      tokens = scanPython(scanner)
      break
    case 'go':
      tokens = scanGo(scanner)
      break
    case 'shell':
      tokens = scanShell(scanner)
      break
    case 'markdown':
      tokens = scanMarkdown(scanner)
      break
    case 'yaml':
      tokens = scanYaml(scanner)
      break
    case 'toml':
      tokens = scanToml(scanner)
      break
    case 'html':
      tokens = scanHtml(scanner)
      break
    default:
      tokens = [{ text, kind: 'plain' }]
  }
  return verifyLossless(text, tokens)
}
