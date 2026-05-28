import type { PrComment, PullRequestState } from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';
import { AGENT_KIND_DEFAULTS } from '../session/agent-kind';

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
    return truncate(`resolve: ${who} on ${loc}`, TITLE_MAX);
  }
  return truncate(`resolve: ${who} comment`, TITLE_MAX);
}

/**
 * Build the kickoff prompt for a resolver agent spawned from a single
 * review comment. The commit-locally policy, EASY/NON-TRIVIAL classifier,
 * and `<<comment-resolved>>` marker emission rule all live in the resolver
 * kind's systemPrompt (agent-kind.ts), so this prompt only supplies the
 * comment-specific context: PR + author + body + path + thread id.
 */
function buildCommentAgentPrompt(c: PrComment, pr: PullRequestState): string {
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
  if (c.source === 'review' && c.threadId) {
    lines.push('');
    lines.push(`Review thread id (for the resolution marker): ${c.threadId}`);
  }
  return lines.join('\n');
}

/**
 * Build the kickoff prompt for a resolver agent that addresses a batch of
 * open review comments in one shot (e.g. when the reviewer requested
 * changes and the user picks 'resolve all'). Same prompt skeleton as the
 * single-comment variant; per-thread markers are not emitted because no
 * one thread owns the resulting commit.
 */
function buildReviewChangesAgentPrompt(
  pr: PullRequestState,
  openComments: ReadonlyArray<PrComment>,
): string {
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
    'Address every comment with the smallest reasonable change. Do not over-scope. The per-comment resolution marker is not applicable here, a single commit covers multiple threads.',
  );
  return lines.join('\n');
}

export interface CommentAgentArgs {
  readonly name: string;
  readonly kind: AgentKind;
  readonly model: string;
  readonly effort: 'low' | 'medium' | 'high';
  readonly initialPrompt: string;
}

export function buildCommentAgentArgs(c: PrComment, pr: PullRequestState): CommentAgentArgs {
  const defaults = AGENT_KIND_DEFAULTS.resolver;
  return {
    name: buildCommentAgentTitle(c),
    kind: 'resolver',
    model: defaults.model,
    effort: defaults.effort,
    initialPrompt: buildCommentAgentPrompt(c, pr),
  };
}

export function buildReviewChangesAgentArgs(
  pr: PullRequestState,
  openComments: ReadonlyArray<PrComment>,
): CommentAgentArgs {
  const defaults = AGENT_KIND_DEFAULTS.resolver;
  return {
    name: truncate(`resolve: address review changes on #${pr.number}`, TITLE_MAX),
    kind: 'resolver',
    model: defaults.model,
    effort: defaults.effort,
    initialPrompt: buildReviewChangesAgentPrompt(pr, openComments),
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
