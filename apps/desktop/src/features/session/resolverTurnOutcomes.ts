import {
  extractAllCommentAnalysis,
  extractAllCommentNeedsInput,
  extractAllCommentReplies,
  extractAllCommentResolved,
  extractAllCommentWontfix,
} from '@goodboy/core';

export type ResolverThreadOutcome =
  | { readonly kind: 'resolved'; readonly commitSha: string; readonly reply?: string }
  | { readonly kind: 'wontfix'; readonly reason: string; readonly reply?: string }
  | { readonly kind: 'analyzed'; readonly reply?: string; readonly verdict?: 'fix' | 'wontfix' };

export type ResolverThreadQuestion = {
  readonly question: string;
  readonly options: ReadonlyArray<string>;
  readonly recommended: string | null;
};

type Params = {
  readonly assistantText: string;
  readonly previousOutcomes: Readonly<Record<string, ResolverThreadOutcome>>;
};

export type ResolverTurnOutcomes = {
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly turnOutcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly questions: Readonly<Record<string, ResolverThreadQuestion>>;
  readonly markerCount: number;
  readonly analysisVerdicts: Readonly<Record<string, 'fix' | 'wontfix'>>;
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
    turnOutcomes[marker.threadId] = {
      kind: 'analyzed',
      reply: marker.summary,
      ...(marker.verdict === 'fix' && { verdict: 'fix' }),
    };
  }
  const questions: Record<string, ResolverThreadQuestion> = {};
  const askedMarkers = extractAllCommentNeedsInput(assistantText).filter(
    (marker) => turnOutcomes[marker.threadId] === undefined,
  );
  for (const marker of askedMarkers) {
    questions[marker.threadId] = {
      question: marker.question,
      options: marker.options,
      recommended: marker.recommended,
    };
  }
  let reworkedReplies = 0;
  for (const marker of extractAllCommentReplies(assistantText)) {
    if (questions[marker.threadId] !== undefined) {
      continue;
    }
    const outcome = turnOutcomes[marker.threadId] ?? previousOutcomes[marker.threadId];
    if (outcome === undefined) {
      continue;
    }
    if (turnOutcomes[marker.threadId] === undefined) {
      reworkedReplies += 1;
    }
    turnOutcomes[marker.threadId] = { ...outcome, reply: marker.body };
  }
  const markerCount =
    resolvedMarkers.length +
    wontfixMarkers.length +
    analysisMarkers.length +
    askedMarkers.length +
    reworkedReplies;
  return {
    outcomes: markerCount === 0 ? previousOutcomes : { ...previousOutcomes, ...turnOutcomes },
    turnOutcomes,
    questions,
    markerCount,
    analysisVerdicts: Object.fromEntries(
      analysisMarkers.map((marker) => [marker.threadId, marker.verdict]),
    ),
  };
};
