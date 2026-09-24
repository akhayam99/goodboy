export type ShellLeftSlot = 'none' | 'rail' | 'sessions';

export type ShellLeftOverlaySlot = 'none' | 'peek';

export type ShellFooterScope = 'workspace' | 'app';

export type ShellArrangement = {
  readonly footer: ShellFooterScope;
  readonly leftHidden: boolean;
  readonly leftSidebarCollapsed: boolean;
  readonly leftSlot: ShellLeftSlot;
  readonly leftOverlaySlot: ShellLeftOverlaySlot;
};

type ShellArrangementParams = {
  readonly hasWorkspace: boolean;
  readonly hasActiveSession: boolean;
  readonly isSidebarCollapsed: boolean;
};

export const shellArrangement = ({
  hasWorkspace,
  hasActiveSession,
  isSidebarCollapsed,
}: ShellArrangementParams): ShellArrangement => {
  if (!hasWorkspace || !hasActiveSession) {
    return {
      footer: hasWorkspace ? 'workspace' : 'app',
      leftHidden: true,
      leftSidebarCollapsed: false,
      leftSlot: 'none',
      leftOverlaySlot: 'none',
    };
  }
  return {
    footer: 'workspace',
    leftHidden: false,
    leftSidebarCollapsed: isSidebarCollapsed,
    leftSlot: isSidebarCollapsed ? 'rail' : 'sessions',
    leftOverlaySlot: isSidebarCollapsed ? 'peek' : 'none',
  };
};
