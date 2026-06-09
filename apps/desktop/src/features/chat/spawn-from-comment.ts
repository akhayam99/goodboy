import type { PrComment, ProviderId, PullRequestState } from '@goodboy/types';
import type { AgentKind } from '../session/agent-kind';
import { AGENT_KIND_DEFAULTS } from '../session/agent-kind';
import type { EffortLevel } from './utils/chat-constants';

const TITLE_MAX = 60;

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

function buildCommentAgentPrompt(
  c: PrComment,
  pr: PullRequestState,
  replies: ReadonlyArray<PrComment>,
): string {
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
  if (c.source === 'review' && c.threadId) {
    lines.push('');
    lines.push(`Review thread id (for the resolution marker): ${c.threadId}`);
  }
  return lines.join('\n');
}

export type CommentAgentArgs = {
  readonly name: string;
  readonly kind: AgentKind;
  readonly model: string;
  readonly provider?: ProviderId;
  readonly effort: EffortLevel;
  readonly initialPrompt: string;
  readonly sourceThreadId?: string;
  readonly sourceCommentUrl: string;
};

export type ResolveModelChoice = {
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel;
};

export const buildCommentAgentArgs = (
  c: PrComment,
  pr: PullRequestState,
  choice: ResolveModelChoice = {},
  replies: ReadonlyArray<PrComment> = [],
): CommentAgentArgs => {
  const defaults = AGENT_KIND_DEFAULTS.resolver;
  return {
    name: buildCommentAgentTitle(c),
    kind: 'resolver',
    model: choice.model ?? defaults.model,
    ...(choice.provider !== undefined && { provider: choice.provider }),
    effort: choice.effort ?? defaults.effort,
    initialPrompt: buildCommentAgentPrompt(c, pr, replies),
    ...(c.source === 'review' && c.threadId ? { sourceThreadId: c.threadId } : {}),
    sourceCommentUrl: c.url,
  };
};

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
}
