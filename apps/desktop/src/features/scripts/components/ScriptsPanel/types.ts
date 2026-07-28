import type { WorkspaceScriptId } from '@goodboy/types';

export type Draft = {
  readonly id: WorkspaceScriptId | null;
  readonly name: string;
  readonly body: string;
};

export type PanelState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'detail'; readonly scriptId: WorkspaceScriptId }
  | { readonly kind: 'edit'; readonly draft: Draft };

export type PendingAction = {
  readonly target: PanelState;
};
