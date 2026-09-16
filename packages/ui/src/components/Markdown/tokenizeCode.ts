export type CodeTokenKind =
  'plain' | 'comment' | 'string' | 'property' | 'number' | 'keyword' | 'added' | 'removed';

export type CodeToken = Readonly<{
  kind: CodeTokenKind;
  text: string;
}>;

type LangSpec = Readonly<{
  lineComments: ReadonlyArray<string>;
  blockComment: readonly [string, string] | null;
  quotes: ReadonlyArray<string>;
  keywords: ReadonlySet<string>;
  ignoreKeywordCase: boolean;
  keyedStrings: boolean;
}>;

const words = (value: string): ReadonlySet<string> => new Set(value.split(' '));

const ECMA_KEYWORDS = words(
  'abstract as async await break case catch class const continue declare default delete do else enum export extends finally for from function get if implements import in instanceof interface keyof let new of private protected public readonly return satisfies set static super switch this throw try type typeof var void while yield null true false undefined',
);

const RUST_KEYWORDS = words(
  'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
);

const SHELL_KEYWORDS = words(
  'if then elif else fi for while until do done case esac function in return',
);

const SQL_KEYWORDS = words(
  'select from where insert into values update set delete create table alter drop index view join left right inner outer full on group by order having limit offset union all distinct as and or not null is in exists between like asc desc primary key foreign references default constraint with returning case when then else end',
);

const JSON_KEYWORDS = words('true false null');

const ECMA: LangSpec = {
  lineComments: ['//'],
  blockComment: ['/*', '*/'],
  quotes: ["'", '"', '`'],
  keywords: ECMA_KEYWORDS,
  ignoreKeywordCase: false,
  keyedStrings: false,
};

const JSON_SPEC: LangSpec = {
  lineComments: [],
  blockComment: null,
  quotes: ['"'],
  keywords: JSON_KEYWORDS,
  ignoreKeywordCase: false,
  keyedStrings: true,
};

const SHELL: LangSpec = {
  lineComments: ['#'],
  blockComment: null,
  quotes: ["'", '"'],
  keywords: SHELL_KEYWORDS,
  ignoreKeywordCase: false,
  keyedStrings: false,
};

const SQL: LangSpec = {
  lineComments: ['--'],
  blockComment: ['/*', '*/'],
  quotes: ["'"],
  keywords: SQL_KEYWORDS,
  ignoreKeywordCase: true,
  keyedStrings: false,
};

const RUST: LangSpec = {
  lineComments: ['//'],
  blockComment: ['/*', '*/'],
  quotes: ['"'],
  keywords: RUST_KEYWORDS,
  ignoreKeywordCase: false,
  keyedStrings: false,
};

const LANG_SPECS: Readonly<Record<string, LangSpec>> = {
  ts: ECMA,
  tsx: ECMA,
  typescript: ECMA,
  js: ECMA,
  jsx: ECMA,
  javascript: ECMA,
  json: JSON_SPEC,
  bash: SHELL,
  sh: SHELL,
  shell: SHELL,
  zsh: SHELL,
  sql: SQL,
  rust: RUST,
  rs: RUST,
};

const isWordChar = (ch: string): boolean => /[A-Za-z0-9_$]/.test(ch);
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

const NUMBER_RE = /^(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)/;

const DIFF_META = /^(?:diff |index |--- |\+\+\+ |@@)/;

const tokenizeDiff = ({ code }: { readonly code: string }): ReadonlyArray<CodeToken> => {
  const out: CodeToken[] = [];
  const lines = code.split('\n');
  lines.forEach((line, index) => {
    const text = index === lines.length - 1 ? line : `${line}\n`;
    if (DIFF_META.test(line)) {
      out.push({ kind: 'comment', text });
      return;
    }
    if (line.startsWith('+')) {
      out.push({ kind: 'added', text });
      return;
    }
    if (line.startsWith('-')) {
      out.push({ kind: 'removed', text });
      return;
    }
    out.push({ kind: 'plain', text });
  });
  return out;
};

type KeyStringParams = {
  readonly code: string;
  readonly from: number;
  readonly spec: LangSpec;
};

const isKeyString = ({ code, from, spec }: KeyStringParams): boolean => {
  if (!spec.keyedStrings) {
    return false;
  }
  let at = from;
  while (at < code.length && /\s/.test(code[at] ?? '')) {
    at += 1;
  }
  return code[at] === ':';
};

type ScanParams = {
  readonly code: string;
  readonly spec: LangSpec;
};

const scan = ({ code, spec }: ScanParams): ReadonlyArray<CodeToken> => {
  const out: CodeToken[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain.length > 0) {
      out.push({ kind: 'plain', text: plain });
      plain = '';
    }
  };

  const push = ({ kind, text }: CodeToken) => {
    flush();
    out.push({ kind, text });
  };

  while (i < code.length) {
    const rest = code.slice(i);

    const lineComment = spec.lineComments.find(
      (marker) =>
        rest.startsWith(marker) && (marker !== '#' || i === 0 || /\s/.test(code[i - 1] ?? ' ')),
    );
    if (lineComment !== undefined) {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      push({ kind: 'comment', text: code.slice(i, stop) });
      i = stop;
      continue;
    }

    if (spec.blockComment !== null && rest.startsWith(spec.blockComment[0])) {
      const close = code.indexOf(spec.blockComment[1], i + spec.blockComment[0].length);
      const stop = close === -1 ? code.length : close + spec.blockComment[1].length;
      push({ kind: 'comment', text: code.slice(i, stop) });
      i = stop;
      continue;
    }

    const quote = spec.quotes.find((candidate) => rest.startsWith(candidate));
    if (quote !== undefined) {
      let j = i + quote.length;
      while (j < code.length) {
        if (code[j] === '\\') {
          j += 2;
          continue;
        }
        if (code.startsWith(quote, j)) {
          j += quote.length;
          break;
        }
        if (code[j] === '\n' && quote !== '`') {
          break;
        }
        j += 1;
      }
      const stop = Math.min(j, code.length);
      push({
        kind: isKeyString({ code, from: stop, spec }) ? 'property' : 'string',
        text: code.slice(i, stop),
      });
      i = stop;
      continue;
    }

    const ch = code[i] ?? '';

    if (isDigit(ch) && !isWordChar(code[i - 1] ?? '')) {
      const matched = rest.match(NUMBER_RE)?.[0] ?? '';
      const after = code[i + matched.length] ?? '';
      if (matched.length > 0 && !isWordChar(after)) {
        push({ kind: 'number', text: matched });
        i += matched.length;
        continue;
      }
    }

    if (isWordChar(ch) && !isDigit(ch)) {
      let j = i;
      while (j < code.length && isWordChar(code[j] ?? '')) {
        j += 1;
      }
      const word = code.slice(i, j);
      const lookup = spec.ignoreKeywordCase ? word.toLowerCase() : word;
      if (spec.keywords.has(lookup)) {
        push({ kind: 'keyword', text: word });
      } else {
        plain += word;
      }
      i = j;
      continue;
    }

    plain += ch;
    i += 1;
  }

  flush();
  return out;
};

type Params = {
  readonly code: string;
  readonly lang: string | null;
};

export const tokenizeCode = ({ code, lang }: Params): ReadonlyArray<CodeToken> | null => {
  if (lang === null) {
    return null;
  }
  const key = lang.trim().toLowerCase();
  if (key === 'diff' || key === 'patch') {
    return tokenizeDiff({ code });
  }
  const spec = LANG_SPECS[key];
  if (spec === undefined) {
    return null;
  }
  return scan({ code, spec });
};
