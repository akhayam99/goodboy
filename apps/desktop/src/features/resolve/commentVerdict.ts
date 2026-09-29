import { extractCommentVerdict, type CommentVerdictKind } from '@goodboy/core';
import type { ResolveVerdict, ResolveVerdictKind } from '@goodboy/types';

const KIND_OF: Record<CommentVerdictKind, ResolveVerdictKind> = {
  'fixed-here': 'fixed_elsewhere',
  'not-relevant': 'obsolete',
  'still-needed': 'refix',
};

const shortOf = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);

export const verdictFromTurn = ({
  assistantText,
  threadId,
  now,
}: {
  readonly assistantText: string;
  readonly threadId: string;
  readonly now: number;
}): ResolveVerdict | null => {
  const marker = extractCommentVerdict(assistantText);
  if (marker === null || marker.threadId !== threadId) {
    return null;
  }
  return { kind: KIND_OF[marker.kind], evidence: marker.evidence, sha: marker.sha, checkedAt: now };
};

export const verdictReply = ({ verdict }: { readonly verdict: ResolveVerdict }): string => {
  if (verdict.kind === 'fixed_elsewhere' && verdict.sha !== null) {
    return `Handled in ${shortOf({ sha: verdict.sha })}.`;
  }
  if (verdict.kind === 'obsolete') {
    return verdict.sha === null
      ? 'This code is no longer part of the branch, so there is nothing left to change. Closing.'
      : `This code was removed in ${shortOf({ sha: verdict.sha })}, so there is nothing left to change. Closing.`;
  }
  return '';
};

export const foldedReply = ({ landedAs }: { readonly landedAs: string }): string =>
  `Handled in ${shortOf({ sha: landedAs })}.`;

export const RECHECK_NO_ANSWER = 'The check ended without an answer. Check again.';
export const RECHECK_NOT_STARTED = 'The check could not start. Check again.';
