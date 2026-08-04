import type { AgentSourceKind, PrComment, ProviderId, PullRequestState } from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';
import type { CommentThread } from '../github/comment-threads';
import { kindRouting } from '../session/agent-kind';
import { prCommentLocation } from '../session/pr-comment-location';
import { RESOLVER_KICKOFF_LABELS } from './utils/resolverKickoffLabels';
import type { EffortLevel } from './utils/chat-constants';

const TITLE_MAX = 60;

const REPLY_CONTRACT: ReadonlyArray<string> = [
  'Every <<comment-reply>> block follows this contract.',
  'Goodboy wraps your block in a fixed structure when it posts: a verdict label ("Valid." for a fix, "Not applying." for a close) opens the first paragraph, and a "Resolution." paragraph naming the commit or the closing reason is appended below. Write only what goes between them.',
  'So never state the outcome and never name the commit sha: no "Fixed in `abc1234`.", no "Not applying this one.", no "Resolved in", no closing sentence. Both would read twice.',
  'Write the reason, in GitHub-flavored markdown addressed to the reviewer: what was actually wrong, or why the change is not the right one.',
  'Two to four sentences, or two to four `-` bullets when there is more than one independent point, one claim per bullet. One sentence is enough when the cause is obvious.',
  'Put identifiers, paths, symbols and commit shas in backticks. No headings, no bold runs, no block quotes, no nested lists, no tables.',
  'Stay under 40 words on a straightforward thread. Never go past 120 words, and only get near it when the reasoning genuinely matters.',
  'Summarize a long enumeration with a count instead of listing it, as in "about 50 other routes follow the same convention".',
  "Past tense for what you did, present tense for what is true of the code. No praise openers, no apologies, no hedging, no restating the reviewer's own words.",
  'Leave out the investigation narrative and the list of everything you checked.',
  'A good reply reads like this:',
  '',
  '- `apps/web/src/routes/` uses camelCase folders that mirror the URL slug.',
  '- Renaming this one alone would break the convention in about 50 sibling routes.',
];

const ANALYSIS_SUMMARY_PLAIN_TEXT =
  'The summary must be one paragraph of plain text with no double quotes.';

const ANALYSIS_SUMMARY_SCOPE =
  'That plain-text rule covers the summary attribute only: the <<comment-reply>> block stays markdown and keeps the reply contract above.';

const EXAMPLE_SHA = 'a1b2c3d';

const EXAMPLE_REPLIES: ReadonlyArray<string> = [
  'The lookup ran before the guard, so an empty batch reached `resolveOne` and threw. The guard now returns early.',
  '`apps/web/src/routes/` uses camelCase folders that mirror the URL slug, so renaming this one alone would break about 50 siblings.',
];

const EXAMPLE_FALLBACK_REPLY = 'The answer for this thread, written to the contract below.';

const EXAMPLE_WONTFIX_REASON = 'the naming follows the convention of every sibling route';

const EXAMPLE_ANALYSIS_SUMMARIES = {
  fix: 'the guard runs after the lookup, so an empty batch reaches resolveOne and throws',
  wontfix: 'the naming follows the convention of every sibling route, renaming one breaks the rest',
} as const;

export type ResolveMode = 'fix' | 'analyze';

function shortPath(path: string): string {
  const segments = path.split('/');
  const last = segments.at(-1) ?? path;
  return last;
}

export const buildCommentAgentTitle = (c: PrComment): string => {
  const who = c.author.replace(/\[bot\]$/, '');
  if (c.source === 'review' && c.path) {
    const loc = c.line ? `${shortPath(c.path)}:${c.line}` : shortPath(c.path);
    return truncate(`resolve: ${who} on ${loc}`, TITLE_MAX);
  }
  return truncate(`resolve: ${who} comment`, TITLE_MAX);
};

const quotedBody = ({ body }: { readonly body: string }): ReadonlyArray<string> => {
  const text = body.trim();
  const source = text === '' ? '(empty body)' : text;
  return source.split('\n').map((line) => `${RESOLVER_KICKOFF_LABELS.quote} ${line}`.trimEnd());
};

const threadIdOf = ({ comment }: { readonly comment: PrComment }): string => {
  const threadId = comment.threadId ?? '';
  return comment.source === 'review' ? threadId.trim() : '';
};

const threadBlock = ({
  thread,
  position,
  total,
}: {
  readonly thread: CommentThread;
  readonly position: number;
  readonly total: number;
}): ReadonlyArray<string> => {
  const { head, replies } = thread;
  const lines: Array<string> = [`Thread ${position} of ${total}`];
  const threadId = threadIdOf({ comment: head });
  if (threadId !== '') {
    lines.push(`${RESOLVER_KICKOFF_LABELS.threadId}${threadId}`);
  }
  lines.push(`${RESOLVER_KICKOFF_LABELS.author}${head.author}`);
  const location = prCommentLocation({ comment: head });
  if (location !== null) {
    lines.push(`${RESOLVER_KICKOFF_LABELS.location}${location}`);
  }
  lines.push(`${RESOLVER_KICKOFF_LABELS.link}${head.url}`);
  lines.push(RESOLVER_KICKOFF_LABELS.comment, ...quotedBody({ body: head.body }));
  for (const reply of replies) {
    lines.push(`- reply from ${reply.author}:`, ...quotedBody({ body: reply.body }));
  }
  return lines;
};

const outcomeExample = ({
  threadId,
  mode,
  isWontfix,
}: {
  readonly threadId: string;
  readonly mode: ResolveMode;
  readonly isWontfix: boolean;
}): string => {
  if (mode === 'analyze') {
    const verdict = isWontfix ? 'wontfix' : 'fix';
    return `<<comment-analysis threadId="${threadId}" verdict="${verdict}" summary="${EXAMPLE_ANALYSIS_SUMMARIES[verdict]}">>`;
  }
  if (isWontfix) {
    return `<<comment-wontfix threadId="${threadId}" reason="${EXAMPLE_WONTFIX_REASON}">>`;
  }
  return `<<comment-resolved threadId="${threadId}" commitSha="${EXAMPLE_SHA}">>`;
};

const workedExample = ({
  threadIds,
  mode,
}: {
  readonly threadIds: ReadonlyArray<string>;
  readonly mode: ResolveMode;
}): ReadonlyArray<string> =>
  threadIds.flatMap((threadId, index) => [
    outcomeExample({ threadId, mode, isWontfix: index === 1 }),
    `<<comment-reply id="${threadId}">>${EXAMPLE_REPLIES[index] ?? EXAMPLE_FALLBACK_REPLY}<</comment-reply>>`,
  ]);

const outcomeForms = ({ mode }: { readonly mode: ResolveMode }): ReadonlyArray<string> => {
  if (mode === 'analyze') {
    return [
      'The outcome marker carries your verdict, and nothing else closes the thread:',
      '<<comment-analysis threadId="the id above" verdict="fix" summary="one plain-text paragraph">> when the thread deserves a change.',
      '<<comment-analysis threadId="the id above" verdict="wontfix" summary="one plain-text paragraph">> when it does not.',
      ANALYSIS_SUMMARY_PLAIN_TEXT,
      ANALYSIS_SUMMARY_SCOPE,
    ];
  }
  return [
    'Pick one outcome marker per thread:',
    '<<comment-resolved threadId="the id above" commitSha="the sha you committed">> when the change is committed.',
    '<<comment-wontfix threadId="the id above" reason="one plain-text line">> when the thread closes with no change.',
  ];
};

const reportingSection = ({
  threadIds,
  mode,
}: {
  readonly threadIds: ReadonlyArray<string>;
  readonly mode: ResolveMode;
}): ReadonlyArray<string> => {
  const count = threadIds.length;
  const noun = count === 1 ? 'thread' : 'threads';
  const subject =
    count === 1 ? 'the thread id listed above' : `each of the ${count} thread ids listed above`;
  return [
    RESOLVER_KICKOFF_LABELS.reporting,
    `Report every thread at the end of the same turn: exactly one outcome marker and exactly one reply block for ${subject}, each on its own line.`,
    'Never emit two outcome markers for one thread id, never leave a thread id without one, and never reuse a reply on another thread id.',
    ...outcomeForms({ mode }),
    'The reply block carries the answer the reviewer reads, and it posts only on the thread whose id it names:',
    '<<comment-reply id="the id above">>the answer for that thread<</comment-reply>>',
    `A complete report for the ${count} ${noun} of this run reads exactly like this:`,
    ...workedExample({ threadIds, mode }),
  ];
};

const instructionsSection = ({
  mode,
  count,
}: {
  readonly mode: ResolveMode;
  readonly count: number;
}): ReadonlyArray<string> => {
  const target = count === 1 ? 'the thread above' : `all ${count} threads above`;
  const decide = count === 1 ? 'decide whether it deserves' : 'decide for each whether it deserves';
  if (mode === 'analyze') {
    return [
      RESOLVER_KICKOFF_LABELS.instructions,
      `Investigate ${target} in one pass and ${decide} a change.`,
      'Analysis mode: do not modify or commit any file, this run is read-only.',
    ];
  }
  return [
    RESOLVER_KICKOFF_LABELS.instructions,
    `Fix ${target} in one pass, committing locally as you go.`,
    'Leave a thread unchanged when the change it asks for is wrong, and say why in its outcome marker.',
  ];
};

type KickoffParams = {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState;
  readonly mode: ResolveMode;
  readonly hint: string;
};

const buildResolverKickoff = ({ threads, pr, mode, hint }: KickoffParams): string => {
  const verb = mode === 'analyze' ? 'Analyze' : 'Resolve';
  const noun = threads.length === 1 ? 'thread' : 'threads';
  const lines: Array<string> = [
    `${verb} ${threads.length} ${noun} on PR #${pr.number}, branch \`${pr.headBranch}\`.`,
  ];
  for (const [index, thread] of threads.entries()) {
    lines.push('', ...threadBlock({ thread, position: index + 1, total: threads.length }));
  }
  lines.push('', ...instructionsSection({ mode, count: threads.length }));
  const threadIds = threads.flatMap((thread) => {
    const threadId = threadIdOf({ comment: thread.head });
    return threadId === '' ? [] : [threadId];
  });
  if (threadIds.length > 0) {
    lines.push('', ...reportingSection({ threadIds, mode }));
    lines.push('', RESOLVER_KICKOFF_LABELS.replyContract, ...REPLY_CONTRACT);
  }
  const operatorNotes = hint.trim();
  if (operatorNotes.length > 0) {
    lines.push('', RESOLVER_KICKOFF_LABELS.operatorNotes, operatorNotes);
  }
  return lines.join('\n');
};

export type CommentAgentArgs = {
  readonly name: string;
  readonly kind: AgentKind;
  readonly model: string;
  readonly provider?: ProviderId;
  readonly effort: EffortLevel;
  readonly initialPrompt: string;
  readonly sourceThreadId?: string;
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl: string;
  readonly sourceKind: AgentSourceKind;
  readonly mode?: ResolveMode;
};

export const buildCombinedCommentAgentArgs = (
  threads: ReadonlyArray<CommentThread>,
  pr: PullRequestState,
  choice: ResolveModelChoice = {},
): CommentAgentArgs => {
  const defaults = kindRouting({ kind: 'resolver' });
  const first = threads[0];
  if (first === undefined) {
    throw new Error('combined resolver requires at least one thread');
  }
  const sourceThreadIds = threads.flatMap((thread) =>
    thread.head.threadId != null ? [thread.head.threadId] : [],
  );
  const mode = choice.mode ?? 'fix';
  return {
    name: `resolve: ${threads.length} review threads`,
    kind: 'resolver',
    model: choice.model ?? defaults.model,
    ...(choice.provider !== undefined && { provider: choice.provider }),
    effort: choice.effort ?? defaults.effort,
    initialPrompt: buildResolverKickoff({ threads, pr, mode, hint: choice.hint ?? '' }),
    sourceThreadIds,
    sourceCommentUrl: first.head.url,
    sourceKind: 'review_comment',
    ...(mode !== 'fix' && { mode }),
  };
};

export type ResolveModelChoice = {
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel;
  readonly mode?: ResolveMode;
  readonly hint?: string;
};

export const buildCommentAgentArgs = (
  c: PrComment,
  pr: PullRequestState,
  choice: ResolveModelChoice = {},
  replies: ReadonlyArray<PrComment> = [],
): CommentAgentArgs => {
  const defaults = kindRouting({ kind: 'resolver' });
  const mode = choice.mode ?? 'fix';
  return {
    name: buildCommentAgentTitle(c),
    kind: 'resolver',
    model: choice.model ?? defaults.model,
    ...(choice.provider !== undefined && { provider: choice.provider }),
    effort: choice.effort ?? defaults.effort,
    initialPrompt: buildResolverKickoff({
      threads: [{ head: c, replies }],
      pr,
      mode,
      hint: choice.hint ?? '',
    }),
    ...(c.source === 'review' && c.threadId ? { sourceThreadId: c.threadId } : {}),
    sourceCommentUrl: c.url,
    sourceKind: c.source === 'review' ? 'review_comment' : 'issue_comment',
    ...(mode !== 'fix' && { mode }),
  };
};

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
}
