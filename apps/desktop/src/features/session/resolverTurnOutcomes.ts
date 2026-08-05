import {
  extractAllCommentAnalysis,
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
} from '@goodboy/core';
import type { ResolverThreadOutcome } from '../../store/types';

type Params = {
  readonly assistantText: string;
  readonly previousOutcomes: Readonly<Record<string, ResolverThreadOutcome>>;
};

export type ResolverTurnOutcomes = {
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly turnOutcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly markerCount: number;
};

export const resolverTurnOutcomes = ({
  assistantText,
  previousOutcomes,
}: Params): ResolverTurnOutcomes => {
  const resolvedMarkers = extractAllCommentResolved(assistantText);
  const wontfixMarkers = extractAllCommentWontfix(assistantText);
  const analysisMarkers = extractAllCommentAnalysis(assistantText);
  const turnOutcomes: Record<string, ResolverThreadOutcome> = {};
  for (const marker of resolvedMarkers) {
    turnOutcomes[marker.threadId] = { kind: 'resolved', commitSha: marker.commitSha };
  }
  for (const marker of wontfixMarkers) {
    if (turnOutcomes[marker.threadId]?.kind === 'resolved') {
      continue;
    }
    turnOutcomes[marker.threadId] = { kind: 'wontfix', reason: marker.reason };
  }
  for (const marker of analysisMarkers) {
    if (turnOutcomes[marker.threadId]?.kind === 'resolved') {
      continue;
    }
    turnOutcomes[marker.threadId] = { kind: 'analyzed', reply: marker.summary };
  }
  for (const marker of extractAllCommentReplies(assistantText)) {
    const outcome = turnOutcomes[marker.threadId];
    if (outcome !== undefined) {
      turnOutcomes[marker.threadId] = { ...outcome, reply: marker.body };
    }
  }
  const markerCount = resolvedMarkers.length + wontfixMarkers.length + analysisMarkers.length;
  return {
    outcomes: markerCount === 0 ? previousOutcomes : { ...previousOutcomes, ...turnOutcomes },
    turnOutcomes,
    markerCount,
  };
};
