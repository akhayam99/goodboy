import type { AgentSourceKind, PrComment, ProviderId, PullRequestState } from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';
import type { CommentThread } from '../github/comment-threads';
import { kindRouting } from '../session/agent-kind';
import type { EffortLevel } from './utils/chat-constants';

const TITLE_MAX = 60;

const REPLY_CONTRACT: ReadonlyArray<string> = [
  'Every <<comment-reply>> block follows this contract.',
  'Write GitHub-flavored markdown addressed to the reviewer.',
  'Start with a verdict line: one short sentence, alone as its own paragraph, stating the outcome and nothing else. Register to aim for: "Fixed in `abc1234`.", "Not applying this one.", "Already handled before this review.", "Applied, with one caveat below."',
  'Add reasoning only when the verdict line leaves something unsaid: two to four sentences, or two to four `-` bullets when there is more than one independent point, one claim per bullet. Skip it entirely when the verdict already says everything.',
  'Put identifiers, paths, symbols and commit shas in backticks. No headings, no bold runs, no block quotes, no nested lists, no tables.',
  'Stay under 40 words on a straightforward thread. Never go past 120 words, and only get near it when the reasoning genuinely matters.',
  'Summarize a long enumeration with a count instead of listing it, as in "about 50 other routes follow the same convention".',
  "Past tense for what you did, present tense for what is true of the code. No praise openers, no apologies, no hedging, no restating the reviewer's own words.",
  'Leave out the investigation narrative and the list of everything you checked.',
  'A good reply reads like this:',
  'Not applying this one.',
  '',
  '- `apps/web/src/routes/` uses camelCase folders that mirror the URL slug.',
  '- Renaming this one alone would break the convention in about 50 sibling routes.',
];

const ANALYSIS_SUMMARY_PLAIN_TEXT =
  'The summary must be one paragraph of plain text with no double quotes.';

const ANALYSIS_SUMMARY_SCOPE =
  'That plain-text rule covers the summary attribute only: the <<comment-reply>> block stays markdown and keeps the reply contract above.';

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

type Params = {
  readonly comment: PrComment;
  readonly pr: PullRequestState;
  readonly replies: ReadonlyArray<PrComment>;
  readonly mode?: ResolveMode;
  readonly hint?: string;
};

const buildCommentAgentPrompt = ({
  comment: c,
  pr,
  replies,
  mode = 'fix',
  hint = '',
}: Params): string => {
  const lines: Array<string> = [];
  lines.push(`Context: PR #${pr.number} on branch \`${pr.headBranch}\`.`);
  if (c.source === 'review' && c.path) {
    lines.push(`${c.author} left a review comment on \`${c.path}${c.line ? `:${c.line}` : ''}\`:`);
  } else {
    lines.push(`${c.author} left this comment on the PR:`);
  }
  lines.push('');
  for (const ln of (c.body.trim() || '(empty body)').split('\n')) {
    lines.push(`> ${ln}`);
  }
  if (replies.length > 0) {
    lines.push('');
    lines.push('Replies in this thread (chronological, for context; resolve the comment above):');
    for (const r of replies) {
      lines.push('');
      lines.push(`${r.author}:`);
      for (const ln of (r.body.trim() || '(empty body)').split('\n')) {
        lines.push(`> ${ln}`);
      }
    }
  }
  lines.push('');
  lines.push(`Comment URL: ${c.url}`);
  const hasReplyBlock = c.source === 'review' && c.threadId != null && c.threadId.length > 0;
  if (hasReplyBlock) {
    lines.push('');
    lines.push(`Review thread id (for the resolution marker): ${c.threadId}`);
    lines.push('');
    lines.push('Write the answer the reviewer will read in this block:');
    lines.push(`<<comment-reply id="${c.threadId}">>your answer<</comment-reply>>`);
    lines.push('It is posted on that thread, and only on that thread, when the thread closes.');
    lines.push('');
    lines.push(...REPLY_CONTRACT);
  }
  if (mode === 'analyze') {
    lines.push('');
    lines.push('Analysis mode: do not modify or commit any file.');
    lines.push('Investigate the comment and produce a short analysis.');
    lines.push('Decide whether the comment is worth fixing.');
    lines.push(
      `End with exactly one marker in this form: <<comment-analysis threadId="${c.threadId ?? ''}" verdict="fix" summary="...">>.`,
    );
    lines.push('Use verdict="wontfix" instead when the comment is not worth fixing.');
    lines.push(ANALYSIS_SUMMARY_PLAIN_TEXT);
    if (hasReplyBlock) {
      lines.push(ANALYSIS_SUMMARY_SCOPE);
    }
  }
  const operatorNotes = hint.trim();
  if (operatorNotes.length > 0) {
    lines.push('');
    lines.push('Operator notes:');
    lines.push(operatorNotes);
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

export const buildCombinedCommentAgentPrompt = (
  comments: ReadonlyArray<CommentThread>,
  pr: PullRequestState,
  choice: ResolveModelChoice = {},
): string => {
  const mode = choice.mode ?? 'fix';
  const verb = mode === 'analyze' ? 'Analyze' : 'Fix';
  const lines: Array<string> = [
    `Context: PR #${pr.number} on branch \`${pr.headBranch}\`.`,
    '',
    `${verb} all ${comments.length} review threads together in one pass.`,
  ];
  for (const [index, thread] of comments.entries()) {
    const comment = thread.head;
    lines.push('', `Thread ${index + 1}:`);
    lines.push(`Comment body from ${comment.author}:`);
    for (const line of (comment.body.trim() || '(empty body)').split('\n')) {
      lines.push(`> ${line}`);
    }
    if (thread.replies.length > 0) {
      lines.push('', 'Replies in this thread:');
      for (const reply of thread.replies) {
        lines.push(`${reply.author}:`);
        for (const line of (reply.body.trim() || '(empty body)').split('\n')) {
          lines.push(`> ${line}`);
        }
      }
    }
    lines.push('', `Comment URL: ${comment.url}`);
    lines.push(`Review thread id (for the resolution marker): ${comment.threadId ?? ''}`);
  }
  lines.push(
    '',
    'After handling every thread, emit exactly one marker per thread, one marker per line.',
    'Use one of these forms for each thread:',
    '<<comment-resolved threadId="PRRT_..." commitSha="...">>',
    '<<comment-wontfix threadId="PRRT_..." reason="...">>',
    '<<comment-analysis threadId="PRRT_..." verdict="fix" summary="...">>',
    'Every review thread id above must receive exactly one marker.',
    '',
    'Also write the answer each reviewer will read, one block per thread:',
    '<<comment-reply id="PRRT_...">>your answer for that thread<</comment-reply>>',
    'A block is posted only on the thread whose id it names, so never reuse one answer for several ids.',
    '',
    ...REPLY_CONTRACT,
  );
  if (mode === 'analyze') {
    lines.push('');
    lines.push('Analysis mode: do not modify or commit any file.');
    lines.push('Investigate every thread and produce a short analysis for each.');
    lines.push('Decide for each thread whether it is worth fixing.');
    lines.push(
      'Use the <<comment-analysis threadId="PRRT_..." verdict="fix" summary="...">> marker for every thread, never <<comment-resolved>>.',
    );
    lines.push('Use verdict="wontfix" instead when a thread is not worth fixing.');
    lines.push(ANALYSIS_SUMMARY_PLAIN_TEXT);
    lines.push(ANALYSIS_SUMMARY_SCOPE);
  }
  const operatorNotes = (choice.hint ?? '').trim();
  if (operatorNotes.length > 0) {
    lines.push('');
    lines.push('Operator notes:');
    lines.push(operatorNotes);
  }
  return lines.join('\n');
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
    initialPrompt: buildCombinedCommentAgentPrompt(threads, pr, choice),
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
    initialPrompt: buildCommentAgentPrompt({ comment: c, pr, replies, mode, hint: choice.hint }),
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
