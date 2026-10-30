import { AUTO_WRITER_ROLES, isAutoWriterRole, type AutoDelegationRole } from './roles';

const COMMAND_TOOL_RE =
  /\b(?:git|gh|npm|pnpm|yarn|cargo|make|docker|kubectl|curl)[ \t]+[a-z][a-z-]*/i;
const RUN_COMMAND_RE =
  /\b(?:run|execute|invoke)\b[^.\n]{0,40}\b(?:commands?|scripts?|tests?|build|lint|typecheck)\b/i;
const LS_REMOTE_RE = /\bls-remote\b/i;
const COMMIT_RANGE_RE = /\b(?=[0-9a-f]{0,39}\d)[0-9a-f]{7,40}\.{2,3}[\w/-]+|\.{2,3}HEAD\b/i;

const MISSING_SHELL_RE =
  /\bno (?:shell|bash|terminal)\b|\b(?:shell|bash|terminal) tool\b|\bcannot run (?:commands?|shell)\b|\b(?:did not|didn't|does not|doesn't|do not|don't) have (?:a )?(?:shell|bash)\b/i;

type RoleParams = {
  readonly role: AutoDelegationRole;
};

type TextParams = {
  readonly text: string;
};

export const canAutoRoleRunCommands = ({ role }: RoleParams): boolean => isAutoWriterRole({ role });

export const AUTO_COMMAND_ROLES: ReadonlyArray<AutoDelegationRole> = AUTO_WRITER_ROLES;

const NEGATION_WORDS: ReadonlySet<string> = new Set([
  'no',
  'not',
  'never',
  'without',
  'avoid',
  'skip',
  'nor',
  'cannot',
  'non',
  'senza',
  'mai',
  'niente',
  'evita',
  'evitare',
  'vietato',
]);
const NEGATION_CONTRACTION_SUFFIX = "n't";
const NEGATION_LOOKBACK_WORDS = 6;
const CLAUSE_BREAK_CHARS: ReadonlySet<string> = new Set(['.', '!', '?', ';', ':', '\n']);
const CLAUSE_BREAK_WORDS: ReadonlySet<string> = new Set([
  'but',
  'then',
  'instead',
  'however',
  'except',
  'ma',
  'poi',
]);
const NEW_CLAUSE_VERBS: ReadonlySet<string> = new Set([
  'run',
  'execute',
  'invoke',
  'esegui',
  'lancia',
]);
const HEAD_WINDOW_CHARS = 120;
const NEGATION_TOKEN_RE = /[a-z\u00e0-\u00f6\u00f8-\u00ff']+|,/g;

type NegatedParams = {
  readonly text: string;
  readonly at: number;
};

const clauseHeadOf = ({ text, at }: NegatedParams): string => {
  let start = Math.max(0, at - HEAD_WINDOW_CHARS);
  for (let index = at - 1; index >= start; index -= 1) {
    if (CLAUSE_BREAK_CHARS.has(text.charAt(index))) {
      start = index + 1;
      break;
    }
  }
  return text.slice(start, at).toLowerCase();
};

type WordParams = {
  readonly word: string;
};

const isNegationWord = ({ word }: WordParams): boolean =>
  NEGATION_WORDS.has(word) || word.endsWith(NEGATION_CONTRACTION_SUFFIX);

const isNegatedMention = ({ text, at }: NegatedParams): boolean => {
  const head = clauseHeadOf({ text, at });
  const tokens = head.match(NEGATION_TOKEN_RE) ?? [];
  let words = 0;
  for (let index = tokens.length - 1; index >= 0 && words < NEGATION_LOOKBACK_WORDS; index -= 1) {
    const token = tokens[index] ?? '';
    if (token === ',') {
      if (NEW_CLAUSE_VERBS.has(tokens[index + 1] ?? '')) {
        return false;
      }
      continue;
    }
    if (CLAUSE_BREAK_WORDS.has(token)) {
      return false;
    }
    if (isNegationWord({ word: token })) {
      return true;
    }
    words += 1;
  }
  return false;
};

const COMMAND_MENTION_PATTERNS: ReadonlyArray<RegExp> = [
  COMMAND_TOOL_RE,
  RUN_COMMAND_RE,
  LS_REMOTE_RE,
  COMMIT_RANGE_RE,
];

export const commandMentionOf = ({ text }: TextParams): string | null => {
  let found: { readonly at: number; readonly phrase: string } | null = null;
  for (const pattern of COMMAND_MENTION_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      const at = match.index ?? 0;
      if (found !== null && at >= found.at) {
        break;
      }
      if (!isNegatedMention({ text, at })) {
        found = { at, phrase: match[0].trim() };
        break;
      }
    }
  }
  return found === null ? null : found.phrase;
};

export const isMissingShellText = ({ text }: TextParams): boolean => MISSING_SHELL_RE.test(text);

type CommandMessageParams = RoleParams & {
  readonly match?: string | null;
};

type MatchParams = {
  readonly match: string | null;
};

const matchSentenceOf = ({ match }: MatchParams): string =>
  match === null
    ? ''
    : ` The task matched: \`${match}\`. Reword or drop that phrase if the task does not need the command run (a phrase after no, never or do not is not counted).`;

export const roleCannotRunCommandsMessage = ({
  role,
  match = null,
}: CommandMessageParams): string =>
  `${role} has no shell, so it cannot run commands such as git or tests. A task that runs commands goes to a role that can: ${AUTO_COMMAND_ROLES.join(', ')}. Say in the task that the check is read only. A task that only reads files can stay with ${role}: write it without command lines. Commits, pull request, review thread and check facts of a branch are not commands: a scout with "facts" naming the mounts gets them read by Goodboy.${matchSentenceOf({ match })}`;

export const rerouteHintOf = ({ role }: RoleParams): string =>
  `  it had no shell tool, so the work did not run. This is not the answer for the user: hand the same task once to a role that can run commands (${AUTO_COMMAND_ROLES.filter((candidate) => candidate !== role).join(', ')}), and say the check is read only. Pull request and branch facts go to a scout whose "facts" names the mounts, not to a writer.`;
