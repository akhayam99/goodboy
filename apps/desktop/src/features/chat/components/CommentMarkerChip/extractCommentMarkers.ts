import {
  extractAllCommentAnalysis,
  extractAllCommentResolved,
  extractAllCommentWontfix,
} from '@goodboy/core';
import type { CommentMarker } from './commentMarker';

type Params = {
  readonly assistantText: string;
  readonly kind: CommentMarker['kind'];
};

export const extractCommentMarkers = ({
  assistantText,
  kind,
}: Params): ReadonlyArray<CommentMarker> => {
  switch (kind) {
    case 'analysis':
      return extractAllCommentAnalysis(assistantText).map((value) => ({ kind, value }));
    case 'resolved':
      return extractAllCommentResolved(assistantText).map((value) => ({ kind, value }));
    case 'wontfix':
      return extractAllCommentWontfix(assistantText).map((value) => ({ kind, value }));
    default: {
      const exhaustiveKind: never = kind;
      return exhaustiveKind;
    }
  }
};
