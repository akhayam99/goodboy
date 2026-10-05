import type {
  AgentSourceKind,
  PrComment,
  ProviderId,
  PullRequestState,
  EffortLevel,
  ReplyVoice,
  ResolveCommitStyle,
} from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';
import type { CommentThread } from '../integrations/github/comment-threads';
import { prCommentLocation } from '../session/pr-comment-location';
import { NOTE_AUTHOR_YOU } from '../resolve/notes/noteThread';
import { RESOLVER_KICKOFF_LABELS } from './utils/resolverKickoffLabels';
import {
  humanOfKickoff,
  joinKickoffParts,
  kickoffTail,
  type KickoffParts,
} from './utils/resolverKickoffParts';

const TITLE_MAX = 60;

const REPLY_STRUCTURE: ReadonlyArray<string> = [
  'Every <<comment-reply>> block follows this contract.',
  "Goodboy places your block into the workspace's reply template when it posts, and the template adds the commit or the closing line. Write only the reason.",
  'So never state the outcome and never name the commit sha: no "Fixed in `abc1234`.", no "Not applying this one.", no "Resolved in", no closing sentence. Both would read twice.',
  'Write the reason, in GitHub-flavored markdown addressed to the reviewer: what was actually wrong, or why the change is not the right one.',
  'Put identifiers, paths, symbols and commit shas in backticks. No headings, no bold runs, no block quotes, no nested lists, no tables.',
  'Never go past 120 words, and only get near it when the reasoning genuinely matters.',
  'Summarize a long enumeration with a count instead of listing it, as in "about 50 other routes follow the same convention".',
  'Leave out the investigation narrative and the list of everything you checked.',
];

const TERSE_VOICE: ReadonlyArray<string> = [
  'Voice: terse.',
  'Two to four sentences, or two to four `-` bullets when there is more than one independent point, one claim per bullet. One sentence is enough when the cause is obvious.',
  'Stay under 40 words on a straightforward thread.',
  "Past tense for what you did, present tense for what is true of the code. No praise openers, no apologies, no hedging, no restating the reviewer's own words.",
  'A good reply reads like this:',
  '',
  '- `apps/web/src/routes/` uses camelCase folders that mirror the URL slug.',
  '- Renaming this one alone would break the convention in about 50 sibling routes.',
];

const VOICE_RULES: Record<Exclude<ReplyVoice, 'mine'>, ReadonlyArray<string>> = {
  terse: TERSE_VOICE,
  friendly: [
    'Voice: friendly.',
    'First person, plain words, two to four sentences.',
    'One short thanks when the comment caught a real bug, never more than one, and none otherwise. No apologies, no hedging.',
  ],
  formal: [
    'Voice: formal.',
    'Third person, complete sentences, no contractions, two to four sentences.',
    'No praise, no apologies, no hedging.',
  ],
};

const replyVoiceRules = ({
  voice,
  styleNote,
}: {
  readonly voice: ReplyVoice;
  readonly styleNote: string | null;
}): ReadonlyArray<string> => {
  const note = styleNote?.trim() ?? '';
  if (voice === 'mine' && note !== '') {
    return ["Voice: the maintainer's own. Follow this note on how they write replies:", note];
  }
  return VOICE_RULES[voice === 'mine' ? 'terse' : voice];
};

const EXAMPLE_SHA = 'a1b2c3d';

const EXAMPLE_REPLIES: ReadonlyArray<string> = [
  'The lookup ran before the guard, so an empty batch reached `resolveOne` and threw. The guard now returns early.',
  '`apps/web/src/routes/` uses camelCase folders that mirror the URL slug, so renaming this one alone would break about 50 siblings.',
];

const EXAMPLE_FALLBACK_REPLY = 'The answer for this thread, written to the contract below.';

const EXAMPLE_WONTFIX_REASON = 'the naming follows the convention of every sibling route';

function shortPath(path: string): string {
  const segments = path.split('/');
  const last = segments.at(-1) ?? path;
  return last;
}

export const buildCommentAgentTitle = (c: PrComment): string => {
  const isOwn = c.author === NOTE_AUTHOR_YOU;
  const who = c.author.replace(/\[bot\]$/, '');
  if (c.source === 'review' && c.path) {
    const file = shortPath(c.path);
    return truncate(isOwn ? `Resolve: ${file} comment` : `Resolve: ${who} on ${file}`, TITLE_MAX);
  }
  return truncate(isOwn ? 'Resolve: comment' : `Resolve: ${who} comment`, TITLE_MAX);
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
  isWontfix,
}: {
  readonly threadId: string;
  readonly isWontfix: boolean;
}): string => {
  if (isWontfix) {
    return `<<comment-wontfix threadId="${threadId}" reason="${EXAMPLE_WONTFIX_REASON}">>`;
  }
  return `<<comment-resolved threadId="${threadId}" commitSha="${EXAMPLE_SHA}">>`;
};

const workedExample = ({
  threadIds,
}: {
  readonly threadIds: ReadonlyArray<string>;
}): ReadonlyArray<string> =>
  threadIds.flatMap((threadId, index) => [
    outcomeExample({ threadId, isWontfix: index === 1 }),
    `<<comment-reply id="${threadId}">>${EXAMPLE_REPLIES[index] ?? EXAMPLE_FALLBACK_REPLY}<</comment-reply>>`,
  ]);

const reportingSection = ({
  threadIds,
}: {
  readonly threadIds: ReadonlyArray<string>;
}): ReadonlyArray<string> => {
  const count = threadIds.length;
  const noun = count === 1 ? 'thread' : 'threads';
  const subject =
    count === 1 ? 'the thread id listed above' : `each of the ${count} thread ids listed above`;
  return [
    RESOLVER_KICKOFF_LABELS.reporting,
    `Report every thread as soon as you finish it: exactly one outcome marker for ${subject}, and one reply block for each thread you fixed or left unchanged, each on its own line.`,
    'Never emit two outcome markers for one thread id, never leave a thread id without one, and never reuse a reply on another thread id.',
    'Pick one outcome marker per thread:',
    '<<comment-resolved threadId="the id above" commitSha="the sha you committed">> after a commit.',
    '<<comment-wontfix threadId="the id above" reason="one plain-text line">> without a change.',
    '<<needs-input id="the thread id" options="first option|second option" recommended="the option you recommend, copied from the list">>one sentence naming the choice<</needs-input>> when the comment reads two ways that lead to different code. Give two or three options. A thread reported this way has no reply block yet.',
    'The reply block carries the answer the reviewer reads, and it posts only on the thread whose id it names:',
    '<<comment-reply id="the id above">>the answer for that thread<</comment-reply>>',
    `A complete report for the ${count} ${noun} of this run reads exactly like this:`,
    ...workedExample({ threadIds }),
  ];
};

const instructionsSection = ({ count }: { readonly count: number }): ReadonlyArray<string> => {
  const target = count === 1 ? 'the thread above' : `all ${count} threads above`;
  return [
    RESOLVER_KICKOFF_LABELS.instructions,
    `Judge ${target} on the merits${count === 1 ? '' : ', one thread at a time, in the order given'}. When a thread asks for the right change, implement it and commit locally as you go. When the change it asks for is wrong or not worth making, leave the code unchanged and give the reason in its outcome marker. Never default to either outcome: read the code first, then decide per thread.`,
    ...(count === 1
      ? []
      : [
          'Finish a thread before you start the next: commit its fix and write its outcome marker and reply, then move on.',
        ]),
    'You work alone in your own copy of the branch and nobody answers while you work, so never ask for permission to edit, to commit or to carry on. The owner reviews, accepts and pushes later.',
    'When a comment is unclear, take the most reasonable reading, act on it and name the assumption in the reply. Stop on a thread only when it reads two ways that lead to different code and the code cannot settle which one the reviewer means: report that thread with the needs-input marker and go on.',
  ];
};

const PROCEED_RESOLVER_PROMPT =
  'Proceed with the fix you proposed in your analysis. When done, commit and emit the <<comment-resolved>> marker as instructed.';

type PriorContextIntent = 'retry' | 'recheck' | 'proceed';

export type PriorContext = {
  readonly threadId: string;
  readonly reply?: string | null;
  readonly commitShas?: ReadonlyArray<string>;
  readonly intent: PriorContextIntent;
};

const INTENT_SENTENCE: Record<PriorContextIntent, string> = {
  retry:
    'The reviewer asked for another pass on this thread. Read it again and decide from scratch.',
  recheck:
    'The commit recorded for this thread is no longer reachable on the branch. Find out whether the change it made is on the branch under another commit, was removed on purpose, or still has to be made.',
  proceed: PROCEED_RESOLVER_PROMPT,
};

const amendInstruction = ({ sha }: { readonly sha: string }): string =>
  `You already committed ${sha} for this thread. If that exact commit is still HEAD and \`git branch -r --contains ${sha}\` prints nothing, apply the new changes and run \`git commit --amend --no-edit\` to keep one commit for this thread. If HEAD moved past it or a remote contains it, make a normal new commit instead. Never rebase or force-push.`;

const priorContextBlock = ({
  entries,
}: {
  readonly entries: ReadonlyArray<PriorContext>;
}): ReadonlyArray<string> => {
  const lines: Array<string> = [RESOLVER_KICKOFF_LABELS.priorWork];
  for (const entry of entries) {
    lines.push('', `${RESOLVER_KICKOFF_LABELS.threadId}${entry.threadId}`);
    const reply = entry.reply?.trim() ?? '';
    if (reply !== '') {
      lines.push('- the reply drafted last time:', ...quotedBody({ body: reply }));
    }
    const shas = entry.commitShas ?? [];
    if (shas.length > 0) {
      lines.push(`- commits recorded last time: ${shas.join(', ')}`);
    }
    lines.push(`- ${INTENT_SENTENCE[entry.intent]}`);
    const first = shas[0];
    if (first !== undefined && entry.intent === 'retry') {
      lines.push(`- ${amendInstruction({ sha: first })}`);
    }
  }
  return lines;
};

export type FixupTarget = {
  readonly threadId: string;
  readonly sha: string;
  readonly subject: string;
};

const commitStyleInstruction = ({
  style,
  fixupTargets,
}: {
  readonly style: ResolveCommitStyle;
  readonly fixupTargets: ReadonlyArray<FixupTarget>;
}): ReadonlyArray<string> => {
  if (style === 'new' || fixupTargets.length === 0) {
    return [];
  }
  return [
    RESOLVER_KICKOFF_LABELS.commitStyle,
    'Commit each fix below as a fixup of the commit that introduced the commented line, so the branch can be autosquashed before merge. Every other fix is a normal new commit.',
    ...fixupTargets.map(
      ({ threadId, sha, subject }) =>
        `- ${threadId}: \`git commit --fixup=${sha}\`, so the subject reads \`fixup! ${subject}\``,
    ),
    'Never rebase, squash or force-push.',
  ];
};

export type ResolverStyle = {
  readonly commitStyle?: ResolveCommitStyle;
  readonly fixupTargets?: ReadonlyArray<FixupTarget>;
  readonly voice?: ReplyVoice;
  readonly styleNote?: string | null;
};

type KickoffParams = {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState | null;
  readonly hint: string;
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolverStyle;
};

export const buildResolverKickoffParts = ({
  threads,
  pr,
  hint,
  priorContext,
  style = {},
}: KickoffParams): KickoffParts => {
  const { commitStyle = 'new', fixupTargets = [], voice = 'terse', styleNote = null } = style;
  const noun = threads.length === 1 ? 'thread' : 'threads';
  const head: Array<string> = [
    pr === null
      ? `Resolve ${threads.length} ${noun} left as notes on this branch. There is no pull request: never push, and never open one.`
      : `Resolve ${threads.length} ${noun} on PR #${pr.number}, branch \`${pr.headBranch}\`.`,
  ];
  for (const [index, thread] of threads.entries()) {
    head.push('', ...threadBlock({ thread, position: index + 1, total: threads.length }));
  }
  if (priorContext !== undefined && priorContext.length > 0) {
    head.push('', ...priorContextBlock({ entries: priorContext }));
  }
  const rules: Array<string> = [...instructionsSection({ count: threads.length })];
  const threadIds = threads.flatMap((thread) => {
    const threadId = threadIdOf({ comment: thread.head });
    return threadId === '' ? [] : [threadId];
  });
  const styleLines = commitStyleInstruction({
    style: commitStyle,
    fixupTargets: fixupTargets.filter((target) => threadIds.includes(target.threadId)),
  });
  if (styleLines.length > 0) {
    rules.push('', ...styleLines);
  }
  if (threadIds.length > 0) {
    rules.push('', ...reportingSection({ threadIds }));
    rules.push(
      '',
      RESOLVER_KICKOFF_LABELS.replyContract,
      ...REPLY_STRUCTURE,
      '',
      ...replyVoiceRules({ voice, styleNote }),
    );
  }
  return { head: head.join('\n'), rules: rules.join('\n'), tail: kickoffTail({ hint }) };
};

export const buildResolverKickoff = (params: KickoffParams): string =>
  joinKickoffParts(buildResolverKickoffParts(params));

const recheckInstructions = (): ReadonlyArray<string> => [
  RESOLVER_KICKOFF_LABELS.instructions,
  'This is a read-only check, not a fix. Never edit a file, never stage, never commit, and never run a command that changes the working tree, the index or a ref.',
  'Read with `git log`, `git show`, `git cherry`, `git reflog` and by opening files. Decide whether the change the thread asks for is on the branch now, was removed on purpose, or still has to be made.',
];

const recheckReporting = ({ threadId }: { readonly threadId: string }): ReadonlyArray<string> => [
  RESOLVER_KICKOFF_LABELS.reporting,
  'Report exactly one verdict marker for the thread id above, on its own line, at the end of the same turn:',
  '<<comment-verdict threadId="the id above" verdict="fixed-here" sha="the commit on the branch that carries the change" evidence="one plain-text line">> when the change is on the branch, possibly under another commit.',
  '<<comment-verdict threadId="the id above" verdict="not-relevant" sha="the commit that removed it, or leave sha out" evidence="one plain-text line with the reason">> when the code it points at is gone or the goal no longer applies.',
  '<<comment-verdict threadId="the id above" verdict="still-needed" evidence="one plain-text line">> when the branch still needs the change.',
  'The evidence names the file, the line and the commit you looked at, and never holds a double quote.',
  `A complete report reads exactly like this: <<comment-verdict threadId="${threadId}" verdict="fixed-here" sha="${EXAMPLE_SHA}" evidence="the guard now returns early at src/retry.ts:3">>`,
];

type RecheckKickoffParams = {
  readonly thread: CommentThread;
  readonly pr: PullRequestState | null;
  readonly hint: string;
  readonly priorContext?: ReadonlyArray<PriorContext>;
};

export const buildRecheckKickoffParts = ({
  thread,
  pr,
  hint,
  priorContext,
}: RecheckKickoffParams): KickoffParts => {
  const head: Array<string> = [
    pr === null
      ? 'Re-check 1 thread left as a note on this branch. There is no pull request: never push.'
      : `Re-check 1 thread on PR #${pr.number}, branch \`${pr.headBranch}\`.`,
    '',
    ...threadBlock({ thread, position: 1, total: 1 }),
  ];
  if (priorContext !== undefined && priorContext.length > 0) {
    head.push('', ...priorContextBlock({ entries: priorContext }));
  }
  const rules: Array<string> = [...recheckInstructions()];
  const threadId = threadIdOf({ comment: thread.head });
  if (threadId !== '') {
    rules.push('', ...recheckReporting({ threadId }));
  }
  return { head: head.join('\n'), rules: rules.join('\n'), tail: kickoffTail({ hint }) };
};

export const buildRecheckKickoff = (params: RecheckKickoffParams): string =>
  joinKickoffParts(buildRecheckKickoffParts(params));

export type CommentAgentArgs = {
  readonly name: string;
  readonly kind: AgentKind;
  readonly initialPrompt: string;
  readonly humanPrompt: string;
  readonly sourceThreadId?: string;
  readonly sourceThreadIds?: ReadonlyArray<string>;
  readonly sourceCommentUrl: string;
  readonly sourceKind: AgentSourceKind;
};

type ResolverAgentArgsParams = {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly pr: PullRequestState | null;
  readonly hint?: string;
  readonly priorContext?: ReadonlyArray<PriorContext>;
  readonly style?: ResolverStyle;
};

export const buildResolverAgentArgs = ({
  threads,
  pr,
  hint = '',
  priorContext,
  style,
}: ResolverAgentArgsParams): CommentAgentArgs => {
  const first = threads[0];
  if (first === undefined) {
    throw new Error('combined resolver requires at least one thread');
  }
  const sourceThreadIds = threads.flatMap((thread) =>
    thread.head.threadId != null ? [thread.head.threadId] : [],
  );
  const parts = buildResolverKickoffParts({
    threads,
    pr,
    hint,
    ...(priorContext !== undefined && { priorContext }),
    ...(style !== undefined && { style }),
  });
  return {
    name:
      threads.length === 1
        ? buildCommentAgentTitle(first.head)
        : `Resolve: ${threads.length} review comments`,
    kind: 'resolver',
    initialPrompt: joinKickoffParts(parts),
    humanPrompt: humanOfKickoff(parts),
    sourceThreadIds,
    sourceCommentUrl: first.head.url,
    sourceKind: 'review_comment',
  };
};

export const buildRecheckAgentArgs = ({
  thread,
  pr,
  hint = '',
  priorContext,
}: Omit<RecheckKickoffParams, 'hint'> & { readonly hint?: string }): CommentAgentArgs => {
  const parts = buildRecheckKickoffParts({
    thread,
    pr,
    hint,
    ...(priorContext !== undefined && { priorContext }),
  });
  return {
    name: truncate(`re-check: ${thread.head.author.replace(/\[bot\]$/, '')} comment`, TITLE_MAX),
    kind: 'scout',
    initialPrompt: joinKickoffParts(parts),
    humanPrompt: humanOfKickoff(parts),
    sourceThreadIds: thread.head.threadId == null ? [] : [thread.head.threadId],
    sourceCommentUrl: thread.head.url,
    sourceKind: 'comment_recheck',
  };
};

export type ResolveModelChoice = {
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel;
  readonly hint?: string;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
}
