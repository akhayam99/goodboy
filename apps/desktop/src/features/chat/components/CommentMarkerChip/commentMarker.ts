import type {
  ExtractedCommentAnalysis,
  ExtractedCommentResolution,
  ExtractedCommentWontfix,
} from '@goodboy/core';

export type CommentMarker =
  | {
      readonly kind: 'analysis';
      readonly value: ExtractedCommentAnalysis;
    }
  | {
      readonly kind: 'resolved';
      readonly value: ExtractedCommentResolution;
    }
  | {
      readonly kind: 'wontfix';
      readonly value: ExtractedCommentWontfix;
    };
