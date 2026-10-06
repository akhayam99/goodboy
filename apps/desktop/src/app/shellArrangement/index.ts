export type ShellMode = 'column' | 'classic';

type ShellLeftSlot = 'none' | 'rail' | 'sessions' | 'column';

type ShellLeftOverlaySlot = 'none' | 'peek';

export type ShellFooterScope = 'workspace' | 'app';

export type ShellColumnScope = 'workspace' | 'app';

export type ShellArrangement = {
  readonly mode: ShellMode;
  readonly footer: ShellFooterScope | null;
  readonly columnScope: ShellColumnScope;
  readonly leftHidden: boolean;
  readonly leftSidebarCollapsed: boolean;
  readonly leftSlot: ShellLeftSlot;
  readonly leftOverlaySlot: ShellLeftOverlaySlot;
  readonly studioCoversLeft: boolean;
};

type ShellArrangementParams = {
  readonly hasWorkspace: boolean;
  readonly hasActiveSession: boolean;
  readonly isSidebarCollapsed: boolean;
  readonly mode?: ShellMode;
};

const classicArrangement = ({
  hasWorkspace,
  hasActiveSession,
  isSidebarCollapsed,
}: ShellArrangementParams): ShellArrangement => {
  const columnScope: ShellColumnScope = hasWorkspace ? 'workspace' : 'app';
  if (!hasWorkspace || !hasActiveSession) {
    return {
      mode: 'classic',
      footer: hasWorkspace ? 'workspace' : 'app',
      columnScope,
      leftHidden: true,
      leftSidebarCollapsed: false,
      leftSlot: 'none',
      leftOverlaySlot: 'none',
      studioCoversLeft: true,
    };
  }
  return {
    mode: 'classic',
    footer: 'workspace',
    columnScope,
    leftHidden: false,
    leftSidebarCollapsed: isSidebarCollapsed,
    leftSlot: isSidebarCollapsed ? 'rail' : 'sessions',
    leftOverlaySlot: isSidebarCollapsed ? 'peek' : 'none',
    studioCoversLeft: true,
  };
};

export const shellArrangement = ({
  hasWorkspace,
  hasActiveSession,
  isSidebarCollapsed,
  mode = 'column',
}: ShellArrangementParams): ShellArrangement => {
  if (mode === 'classic') {
    return classicArrangement({ hasWorkspace, hasActiveSession, isSidebarCollapsed });
  }
  return {
    mode: 'column',
    footer: null,
    columnScope: hasWorkspace ? 'workspace' : 'app',
    leftHidden: false,
    leftSidebarCollapsed: isSidebarCollapsed,
    leftSlot: isSidebarCollapsed ? 'rail' : 'column',
    leftOverlaySlot: isSidebarCollapsed && hasWorkspace ? 'peek' : 'none',
    studioCoversLeft: false,
  };
};
