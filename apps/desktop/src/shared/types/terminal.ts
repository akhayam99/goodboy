import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';

export type TerminalTabId = string & { readonly __brand: 'TerminalTabId' };

export type TerminalTabStatus = 'running' | 'exited' | 'attention';

export type TerminalOwner =
  | { readonly kind: 'session'; readonly sessionId: SessionId }
  | { readonly kind: 'workspace'; readonly workspaceId: WorkspaceId };

export type TerminalTab = {
  readonly id: TerminalTabId;
  readonly owner: TerminalOwner;
  readonly title: string;
  readonly cwd: string | null;
  readonly projectId?: ProjectId;
  readonly mountId?: MountId;
  readonly status: TerminalTabStatus;
  readonly openError?: string;
  readonly prefill?: string;
  readonly isRestored?: boolean;
  readonly createdAt: number;
};

export type TerminalSelection = {
  readonly sessionId: SessionId | null;
  readonly worktree: string | null;
  readonly terminalId: TerminalTabId | null;
};
