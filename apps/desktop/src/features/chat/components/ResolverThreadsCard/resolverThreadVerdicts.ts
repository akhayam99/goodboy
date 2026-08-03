import type {
  ExtractedCommentAnalysis,
  ExtractedCommentResolution,
  ExtractedCommentWontfix,
} from '@goodboy/core';
import type { ResolverThreadSettlementKind } from '../../../session/resolverThreadSettlements';

export type ResolverThreadVerdict = {
  readonly threadId: string;
  readonly kind: ResolverThreadSettlementKind;
  readonly isClosed: boolean;
  readonly text: string;
};

type Params = {
  readonly analysisMarkers: ReadonlyArray<ExtractedCommentAnalysis>;
  readonly resolvedMarkers: ReadonlyArray<ExtractedCommentResolution>;
  readonly wontfixMarkers: ReadonlyArray<ExtractedCommentWontfix>;
  readonly resolvedOnGithub: ReadonlySet<string>;
  readonly queuedThreadIds: ReadonlySet<string>;
};

export const resolverThreadVerdicts = ({
  analysisMarkers,
  resolvedMarkers,
  wontfixMarkers,
  resolvedOnGithub,
  queuedThreadIds,
}: Params): ReadonlyArray<ResolverThreadVerdict> => [
  ...analysisMarkers.map((marker) => ({
    threadId: marker.threadId,
    kind: 'analyzed' as const,
    isClosed: resolvedOnGithub.has(marker.threadId),
    text: resolvedOnGithub.has(marker.threadId)
      ? 'marked solved with explanation'
      : `${marker.verdict === 'fix' ? 'fix recommended' : 'no change recommended'}: ${marker.summary}`,
  })),
  ...resolvedMarkers.map((marker) => ({
    threadId: marker.threadId,
    kind: 'resolved' as const,
    isClosed: resolvedOnGithub.has(marker.threadId),
    text: resolvedOnGithub.has(marker.threadId)
      ? 'conversation resolved'
      : queuedThreadIds.has(marker.threadId)
        ? 'solved locally, pending push'
        : `fix committed locally (${marker.commitSha.slice(0, 7)})`,
  })),
  ...wontfixMarkers.map((marker) => ({
    threadId: marker.threadId,
    kind: 'wontfix' as const,
    isClosed: resolvedOnGithub.has(marker.threadId),
    text: resolvedOnGithub.has(marker.threadId) ? 'marked solved with explanation' : marker.reason,
  })),
];
