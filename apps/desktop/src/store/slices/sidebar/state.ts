import type { WorkspaceId, SessionId } from '@goodboy/types';
import type { PanelSection } from './types';

export type SidebarState = {
  readonly unreadWorkspaceIds: ReadonlySet<WorkspaceId>;
  readonly sessionPanelExpanded: Readonly<
    Record<SessionId, Partial<Record<PanelSection, boolean>>>
  >;
};

export const sidebarInitialState: SidebarState = {
  unreadWorkspaceIds: new Set<WorkspaceId>(),
  sessionPanelExpanded: {},
};
