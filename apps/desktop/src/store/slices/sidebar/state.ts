import type { WorkspaceId, SessionId } from '@goodboy/types';
import type { PanelSection } from './types';

export type WorkspaceAttentionEntry = {
  readonly count: number;
  readonly tone: 'danger' | 'warning';
  readonly reasonWords: ReadonlyArray<string>;
};

export type WorkspaceAttentionMap = Readonly<Record<string, WorkspaceAttentionEntry>>;

export type SidebarState = {
  readonly unreadWorkspaceIds: ReadonlySet<WorkspaceId>;
  readonly attentionFromDatabase: WorkspaceAttentionMap;
  readonly attentionFromWindows: WorkspaceAttentionMap;
  readonly sessionPanelExpanded: Readonly<
    Record<SessionId, Partial<Record<PanelSection, boolean>>>
  >;
};

export const sidebarInitialState: SidebarState = {
  unreadWorkspaceIds: new Set<WorkspaceId>(),
  attentionFromDatabase: {},
  attentionFromWindows: {},
  sessionPanelExpanded: {},
};
