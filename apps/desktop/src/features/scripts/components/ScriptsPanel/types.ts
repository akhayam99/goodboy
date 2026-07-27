import type { WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';

export type Draft = {
  readonly id: WorkspaceScriptId | null;
  readonly name: string;
  readonly body: string;
};

export type PendingAction =
  | { readonly kind: 'new' }
  | { readonly kind: 'select'; readonly script: WorkspaceScript }
  | { readonly kind: 'close' };
