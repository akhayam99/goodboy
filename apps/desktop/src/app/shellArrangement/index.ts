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
  readonly isSettingsOpen?: boolean;
};

export const shellArrangement = ({
  hasWorkspace,
  isSidebarCollapsed,
  isSettingsOpen = false,
}: ShellArrangementParams): ShellArrangement => {
  const isRail = isSidebarCollapsed && !isSettingsOpen;
  return {
    columnScope: hasWorkspace ? 'workspace' : 'app',
    leftSidebarCollapsed: isSidebarCollapsed,
    isLeftRail: isRail,
    leftSlot: isRail ? 'rail' : 'column',
    leftOverlaySlot: isRail && hasWorkspace ? 'peek' : 'none',
    studioCoversLeft: false,
  };
};
