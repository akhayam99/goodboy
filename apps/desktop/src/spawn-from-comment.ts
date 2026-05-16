import type { PrComment, PullRequestState } from '@kay-am/types';
import type { AgentKind } from './agent-kind';
import { AGENT_KIND_DEFAULTS } from './agent-kind';

const TITLE_MAX = 60;

function shortPath(path: string): string {
  const segments = path.split('/');
  const last = segments.at(-1) ?? path;
  return last;
}

export function buildCommentAgentTitle(c: PrComment): string {
  const who = c.author.replace(/\[bot\]$/, '');
  if (c.source === 'review' && c.path) {
    const loc = c.line ? `${shortPath(c.path)}:${c.line}` : shortPath(c.path);
    return truncate(`fix: ${who} on ${loc}`, TITLE_MAX);
  }
  return truncate(`fix: ${who} comment`, TITLE_MAX);
}

export function buildCommentAgentPrompt(c: PrComment, pr: PullRequestState): string {
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
  lines.push('');
  lines.push(`Comment URL: ${c.url}`);
  lines.push('');
  lines.push(
    'Your task: address this comment with the smallest reasonable change. Read the file, apply the change, run lint/tests, commit and push. Do not over-scope.',
  );
  return lines.join('\n');
}

export function inferAgentKindFromComment(c: PrComment): AgentKind {
  // review comment with a path → implementer touches the file directly.
  if (c.source === 'review' && c.path) return 'implementer';
  // heuristic for issue comments: bug/error/fail keywords → debugger.
  const lower = c.body.toLowerCase();
  if (/\b(bug|crash|fails?|broken|regression|exception|error)\b/.test(lower)) return 'debugger';
  return 'implementer';
}

export interface CommentAgentArgs {
  readonly name: string;
  readonly model: string;
  readonly effort: 'low' | 'medium' | 'high';
  readonly initialPrompt: string;
}

export function buildCommentAgentArgs(c: PrComment, pr: PullRequestState): CommentAgentArgs {
  const kind = inferAgentKindFromComment(c);
  const defaults = AGENT_KIND_DEFAULTS[kind];
  return {
    name: buildCommentAgentTitle(c),
    model: defaults.model,
    effort: defaults.effort,
    initialPrompt: buildCommentAgentPrompt(c, pr),
  };
}

export function buildReviewChangesAgentArgs(
  pr: PullRequestState,
  openComments: ReadonlyArray<PrComment>,
): CommentAgentArgs {
  const defaults = AGENT_KIND_DEFAULTS.implementer;
  const lines: Array<string> = [];
  lines.push(`Context: PR #${pr.number} on branch \`${pr.headBranch}\`.`);
  lines.push('Reviewers have requested changes. Address every open comment below.');
  lines.push('');
  for (const c of openComments) {
    const loc =
      c.source === 'review' && c.path ? ` on \`${c.path}${c.line ? `:${c.line}` : ''}\`` : '';
    lines.push(`### ${c.author}${loc}`);
    for (const ln of (c.body.trim() || '(empty body)').split('\n')) {
      lines.push(`> ${ln}`);
    }
    lines.push(`(${c.url})`);
    lines.push('');
  }
  lines.push(
    'Your task: address every comment with the smallest reasonable change. Read the files, apply the changes, run lint/tests, commit and push. Do not over-scope.',
  );
  return {
    name: truncate(`fix: address review changes on #${pr.number}`, TITLE_MAX),
    model: defaults.model,
    effort: defaults.effort,
    initialPrompt: lines.join('\n'),
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
