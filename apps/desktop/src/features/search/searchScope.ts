import type { SessionId, WorkspaceId } from '@goodboy/types';

export type SearchScope =
  | {
      readonly kind: 'session';
      readonly sessionId: SessionId;
      readonly workspaceId: WorkspaceId;
      readonly label: string;
    }
  | { readonly kind: 'workspace'; readonly workspaceId: WorkspaceId; readonly label: string }
  | { readonly kind: 'all' };

type WidenParams = {
  readonly scope: SearchScope;
  readonly workspaceLabel: string | null;
};

export const widenScope = ({ scope, workspaceLabel }: WidenParams): SearchScope => {
  if (scope.kind === 'session' && workspaceLabel !== null) {
    return { kind: 'workspace', workspaceId: scope.workspaceId, label: workspaceLabel };
  }
  return { kind: 'all' };
};
