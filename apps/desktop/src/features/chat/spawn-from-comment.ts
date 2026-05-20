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
    'Your task: address this comment with the smallest reasonable change. Read the file, apply the change, run lint/tests. Do not over-scope.',
  );
  lines.push('');
  lines.push('Before committing, classify your change:');
  lines.push(
    'EASY (auto-commit+push): rename, typo, formatting, import fix, small one-liner, adjusting a literal/constant.',
  );
  lines.push(
    'NON-TRIVIAL (stop and ask): structural rework, new/deleted files, multi-file refactor, architecture change, anything you are uncertain about.',
  );
  lines.push('');
  lines.push('If EASY: commit and push immediately.');
  lines.push(
    'If NON-TRIVIAL: stop. Show a short summary of what you changed and why, then ask "Can I commit?" and wait for confirmation before committing.',
  );
  return lines.join('\n');
}

export function inferAgentKindFromComment(c: PrComment): AgentKind {
  // review comment with a path → implementer touches the file directly.
  if (c.source === 'review' && c.path) return 'implementer';
  // heuristic for issue comments: bug/error/fail keywords → debugger.
  const lower = c.body.toLowerCase();
  if (/\b(bugs?|crash(?:es)?|fails?|broken|regressions?|exceptions?|errors?)\b/.test(lower))
    return 'debugger';
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
    'Your task: address every comment with the smallest reasonable change. Read the files, apply the changes, run lint/tests. Do not over-scope.',
  );
  lines.push('');
  lines.push('Before committing, classify the overall change:');
  lines.push(
    'EASY (auto-commit+push): all fixes are renames, typos, formatting, import fixes, small one-liners, adjusting literals/constants.',
  );
  lines.push(
    'NON-TRIVIAL (stop and ask): any fix involves structural rework, new/deleted files, multi-file refactor, architecture change, or anything you are uncertain about.',
  );
  lines.push('');
  lines.push('If EASY: commit and push immediately.');
  lines.push(
    'If NON-TRIVIAL: stop. Show a short summary of what you changed and why, then ask "Can I commit?" and wait for confirmation before committing.',
  );
  return {
    name: truncate(`resolve: address review changes on #${pr.number}`, TITLE_MAX),
    model: defaults.model,
    effort: defaults.effort,
    initialPrompt: lines.join('\n'),
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
