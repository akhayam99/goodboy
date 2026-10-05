import { createContext } from 'react';
import type { ArtifactComment, ArtifactCommentAnchor } from '@goodboy/types';

export type ComposingTarget = Readonly<{
  anchor: ArtifactCommentAnchor;
}>;

export type PlanCommentsApi = Readonly<{
  comments: ReadonlyArray<ArtifactComment>;
  revision: number;
  canComment: boolean;
  composing: ComposingTarget | null;
  startComposing: (params: { readonly anchor: ArtifactCommentAnchor }) => void;
  cancelComposing: () => void;
  add: (params: { readonly body: string }) => Promise<void>;
  edit: (params: { readonly commentId: string; readonly body: string }) => Promise<void>;
  remove: (params: { readonly commentId: string }) => Promise<void>;
}>;

export const PlanCommentsContext = createContext<PlanCommentsApi | null>(null);
