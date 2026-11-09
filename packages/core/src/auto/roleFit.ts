import { isClauseBreakWord, isNegationWord } from './roleTools';
import { isAutoRoleStartable, type AutoDelegationRole } from './roles';

type FitScope = 'whole' | 'lead';

type FitTrigger = Readonly<{
  steps: ReadonlyArray<ReadonlySet<string>>;
  isVerbLed?: boolean;
  isNegationBlind?: boolean;
}>;

type FitRow = Readonly<{
  role: AutoDelegationRole;
  scope: FitScope;
  seen: string;
  label: string;
  triggers: ReadonlyArray<FitTrigger>;
}>;

const PR_WORDS: ReadonlySet<string> = new Set(['pr', 'pull', 'mr']);

const ROLE_FIT_ROWS: ReadonlyArray<FitRow> = [
  {
    role: 'rewriter',
    scope: 'whole',
    seen: 'regroups commits',
    label: 'a rewriter',
    triggers: [
      {
        steps: [new Set(['regroup', 'regroups', 'regrouping', 'recluster', 'autosquash'])],
      },
      {
        steps: [
          new Set([
            'squash',
            'squashes',
            'reword',
            'rewords',
            'split',
            'reorder',
            'tidy',
            'clean',
            'cleanup',
            'rewrite',
            'regroup',
          ]),
          new Set(['commit', 'commits', 'fixup', 'fixups']),
        ],
      },
    ],
  },
  {
    role: 'ci-fixer',
    scope: 'whole',
    seen: 'names a red check',
    label: 'a CI fixer',
    triggers: [
      {
        steps: [
          new Set(['red', 'failing', 'failed', 'broken']),
          new Set(['check', 'checks', 'ci', 'build', 'job', 'workflow', 'pipeline', 'lint']),
        ],
      },
      {
        steps: [
          new Set(['ci', 'pipeline', 'check', 'checks', 'build', 'job', 'workflow', 'lint']),
          new Set(['red', 'fails', 'failing', 'failed', 'broken']),
        ],
      },
      { steps: [new Set(['fix']), new Set(['ci'])] },
    ],
  },
  {
    role: 'scribe',
    scope: 'whole',
    seen: 'writes or opens the pull request',
    label: 'a scribe',
    triggers: [
      { steps: [PR_WORDS, new Set(['title', 'body', 'description', 'text'])] },
      { steps: [new Set(['title', 'body', 'description']), PR_WORDS] },
      {
        isVerbLed: true,
        steps: [new Set(['open', 'create', 'draft', 'raise']), PR_WORDS],
      },
      {
        isVerbLed: true,
        steps: [
          new Set(['open', 'create', 'draft', 'raise']),
          new Set(['merge']),
          new Set(['request']),
        ],
      },
    ],
  },
  {
    role: 'tester',
    scope: 'lead',
    seen: 'asks for tests',
    label: 'a tester',
    triggers: [
      {
        steps: [
          new Set(['write', 'add', 'cover', 'missing', 'extend']),
          new Set(['test', 'tests', 'spec', 'specs', 'coverage']),
        ],
      },
      { steps: [new Set(['regression']), new Set(['test', 'tests'])] },
      {
        isNegationBlind: true,
        steps: [new Set(['no']), new Set(['regression']), new Set(['test', 'tests'])],
      },
      { steps: [new Set(['untested'])] },
    ],
  },
  {
    role: 'docs',
    scope: 'lead',
    seen: 'changes the docs',
    label: 'a docs agent',
    triggers: [
      {
        steps: [
          new Set(['readme', 'readme.md', 'changelog', 'changelog.md', 'documentation', 'docs']),
        ],
      },
      { steps: [new Set(['release']), new Set(['notes'])] },
    ],
  },
];

const STEP_GAP = 2;
const NEGATION_LOOKBACK = 6;
const MIN_LEAD_WORDS = 3;
const CONTINUATION_RE = /;|\bthen\b/;
const DOC_FOLDERS: ReadonlySet<string> = new Set(['docs', 'documentation']);
const DOC_FILES: ReadonlySet<string> = new Set(['readme.md', 'changelog.md']);
const WORD_CHAR_RE = /[a-z0-9'./_-]/;
const EDGE_CHARS: ReadonlySet<string> = new Set(["'", '.', '/', '_', '-']);
const BREAK_CHARS: ReadonlySet<string> = new Set([',', ';', ':', '!', '?', '\n']);
const SENTENCE_END_CHARS: ReadonlySet<string> = new Set(['.', '!', '?']);
const DETERMINERS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'this',
  'that',
  'its',
  'their',
  'our',
  'your',
]);

type TextParams = {
  readonly text: string;
};

type TokenParams = {
  readonly word: string;
};

type WordParams = TokenParams & {
  readonly tokens: string[];
};

const docPathTokenOf = ({ word }: TokenParams): string => {
  const segments = word.split('/');
  const first = segments[0] ?? '';
  const last = segments[segments.length - 1] ?? '';
  if (segments.length > 1 && DOC_FOLDERS.has(first)) {
    return first;
  }
  if (segments.length > 1 && DOC_FILES.has(last)) {
    return last;
  }
  return word;
};

const pushWord = ({ word, tokens }: WordParams): void => {
  let start = 0;
  let end = word.length;
  while (start < end && EDGE_CHARS.has(word.charAt(start))) {
    start += 1;
  }
  let isSentenceEnd = false;
  while (end > start && EDGE_CHARS.has(word.charAt(end - 1))) {
    if (word.charAt(end - 1) === '.') {
      isSentenceEnd = true;
    }
    end -= 1;
  }
  if (end > start) {
    tokens.push(docPathTokenOf({ word: word.slice(start, end) }));
  }
  if (isSentenceEnd) {
    tokens.push('');
  }
};

const fitTokensOf = ({ text }: TextParams): ReadonlyArray<string> => {
  const lower = text.toLowerCase().replaceAll('’', "'");
  const tokens: string[] = [];
  let word = '';
  for (const char of lower) {
    if (WORD_CHAR_RE.test(char)) {
      word += char;
      continue;
    }
    pushWord({ word, tokens });
    word = '';
    if (BREAK_CHARS.has(char)) {
      tokens.push('');
    }
  }
  pushWord({ word, tokens });
  return tokens;
};

const sentenceOf = ({ text }: TextParams): string => {
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === '\n') {
      return text.slice(0, index);
    }
    const next = text.charAt(index + 1);
    if (SENTENCE_END_CHARS.has(char) && (next === '' || next.trim() === '')) {
      return text.slice(0, index);
    }
  }
  return text;
};

const leadSentenceOf = ({ text }: TextParams): string => {
  const sentence = sentenceOf({ text });
  const continuation = sentence.toLowerCase().search(CONTINUATION_RE);
  const primary = continuation === -1 ? sentence : sentence.slice(0, continuation);
  let words = 0;
  let isInWord = false;
  for (let index = 0; index < primary.length; index += 1) {
    const char = primary.charAt(index);
    if (char === ',' && words >= MIN_LEAD_WORDS) {
      return primary.slice(0, index);
    }
    if (char.trim() === '') {
      isInWord = false;
      continue;
    }
    if (!isInWord) {
      isInWord = true;
      words += 1;
    }
  }
  return primary;
};

type MatchParams = {
  readonly tokens: ReadonlyArray<string>;
  readonly at: number;
  readonly trigger: FitTrigger;
};

const matchEndOf = ({ tokens, at, trigger }: MatchParams): number | null => {
  const [first, ...rest] = trigger.steps;
  if (first === undefined || !first.has(tokens[at] ?? '')) {
    return null;
  }
  if (trigger.isVerbLed === true && DETERMINERS.has(tokens[at - 1] ?? '')) {
    return null;
  }
  let cursor = at;
  for (const step of rest) {
    let found = -1;
    const last = Math.min(tokens.length - 1, cursor + 1 + STEP_GAP);
    for (let index = cursor + 1; index <= last; index += 1) {
      const token = tokens[index] ?? '';
      if (token === '') {
        break;
      }
      if (step.has(token)) {
        found = index;
        break;
      }
    }
    if (found === -1) {
      return null;
    }
    cursor = found;
  }
  return cursor;
};

type NegatedParams = {
  readonly tokens: ReadonlyArray<string>;
  readonly start: number;
  readonly end: number;
};

const isNegatedSpan = ({ tokens, start, end }: NegatedParams): boolean => {
  const floor = Math.max(0, start - NEGATION_LOOKBACK);
  for (let index = start - 1; index >= floor; index -= 1) {
    const token = tokens[index] ?? '';
    if (token === '' || isClauseBreakWord({ word: token })) {
      break;
    }
    if (isNegationWord({ word: token })) {
      return true;
    }
  }
  for (let index = start + 1; index < end; index += 1) {
    if (isNegationWord({ word: tokens[index] ?? '' })) {
      return true;
    }
  }
  return false;
};

type RowFitParams = {
  readonly row: FitRow;
  readonly tokens: ReadonlyArray<string>;
};

const doesRowFit = ({ row, tokens }: RowFitParams): boolean => {
  for (let at = 0; at < tokens.length; at += 1) {
    for (const trigger of row.triggers) {
      const end = matchEndOf({ tokens, at, trigger });
      if (end === null) {
        continue;
      }
      if (trigger.isNegationBlind === true || !isNegatedSpan({ tokens, start: at, end })) {
        return true;
      }
    }
  }
  return false;
};

type RoleFitParams = {
  readonly title: string | null;
  readonly task: string;
};

export const roleFitOf = ({ title, task }: RoleFitParams): AutoDelegationRole | null => {
  const heading = title ?? '';
  const whole = fitTokensOf({ text: `${heading}\n${task}` });
  const lead = fitTokensOf({ text: `${heading}\n${leadSentenceOf({ text: task })}` });
  const row = ROLE_FIT_ROWS.find((candidate) =>
    doesRowFit({ row: candidate, tokens: candidate.scope === 'whole' ? whole : lead }),
  );
  if (row === undefined) {
    return null;
  }
  return isAutoRoleStartable({ role: row.role }) ? row.role : 'implementer';
};

type NarrowerParams = {
  readonly fit: AutoDelegationRole;
  readonly chosen: AutoDelegationRole;
};

export const roleNarrowerMessage = ({ fit, chosen }: NarrowerParams): string => {
  const row = ROLE_FIT_ROWS.find((candidate) => candidate.role === fit);
  const seen = row?.seen ?? 'fits a narrower role';
  const label = row?.label ?? `a ${fit}`;
  return `This task ${seen}: ${label} fits. Send it to ${label} ("role":"${fit}"), or keep the ${chosen} with "roleReason": one line on why the ${chosen} fits better. Nothing was started`;
};
