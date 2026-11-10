type ShellLeftSlot = 'rail' | 'column';

type ShellLeftOverlaySlot = 'none' | 'peek';

export type ShellColumnScope = 'workspace' | 'app';

export type ShellArrangement = {
  readonly columnScope: ShellColumnScope;
  readonly leftSidebarCollapsed: boolean;
  readonly isLeftRail: boolean;
  readonly leftSlot: ShellLeftSlot;
  readonly leftOverlaySlot: ShellLeftOverlaySlot;
  readonly studioCoversLeft: boolean;
};

type ShellArrangementParams = {
  readonly hasWorkspace: boolean;
  readonly isSidebarCollapsed: boolean;
};

export const shellArrangement = ({
  hasWorkspace,
  isSidebarCollapsed,
}: ShellArrangementParams): ShellArrangement => ({
  columnScope: hasWorkspace ? 'workspace' : 'app',
  leftSidebarCollapsed: isSidebarCollapsed,
  isLeftRail: isSidebarCollapsed,
  leftSlot: isSidebarCollapsed ? 'rail' : 'column',
  leftOverlaySlot: isSidebarCollapsed && hasWorkspace ? 'peek' : 'none',
  studioCoversLeft: false,
});
