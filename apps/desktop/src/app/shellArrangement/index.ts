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
  readonly isLeftRail: boolean;
  readonly leftSlot: ShellLeftSlot;
  readonly leftOverlaySlot: ShellLeftOverlaySlot;
  readonly studioCoversLeft: boolean;
};

type ShellArrangementParams = {
  readonly hasWorkspace: boolean;
  readonly hasActiveSession: boolean;
  readonly isSidebarCollapsed: boolean;
  readonly mode?: ShellMode;
  readonly isSettingsOpen?: boolean;
};

type ClassicParams = Omit<ShellArrangementParams, 'mode' | 'isSettingsOpen'>;

const classicArrangement = ({
  hasWorkspace,
  hasActiveSession,
  isSidebarCollapsed,
}: ClassicParams): ShellArrangement => {
  const columnScope: ShellColumnScope = hasWorkspace ? 'workspace' : 'app';
  if (!hasWorkspace || !hasActiveSession) {
    return {
      mode: 'classic',
      footer: hasWorkspace ? 'workspace' : 'app',
      columnScope,
      leftHidden: true,
      leftSidebarCollapsed: false,
      isLeftRail: false,
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
    isLeftRail: isSidebarCollapsed,
    leftSlot: isSidebarCollapsed ? 'rail' : 'sessions',
    leftOverlaySlot: isSidebarCollapsed ? 'peek' : 'none',
    studioCoversLeft: true,
  };
};

type ColumnParams = Pick<ShellArrangementParams, 'hasWorkspace' | 'isSidebarCollapsed'> & {
  readonly isSettingsOpen: boolean;
};

const columnArrangement = ({
  hasWorkspace,
  isSidebarCollapsed,
  isSettingsOpen,
}: ColumnParams): ShellArrangement => {
  const isRail = isSidebarCollapsed && !isSettingsOpen;
  return {
    mode: 'column',
    footer: null,
    columnScope: hasWorkspace ? 'workspace' : 'app',
    leftHidden: false,
    leftSidebarCollapsed: isSidebarCollapsed,
    isLeftRail: isRail,
    leftSlot: isRail ? 'rail' : 'column',
    leftOverlaySlot: isRail && hasWorkspace ? 'peek' : 'none',
    studioCoversLeft: false,
  };
};

export const shellArrangement = ({
  hasWorkspace,
  hasActiveSession,
  isSidebarCollapsed,
  mode = 'column',
  isSettingsOpen = false,
}: ShellArrangementParams): ShellArrangement => {
  if (mode === 'classic') {
    return classicArrangement({ hasWorkspace, hasActiveSession, isSidebarCollapsed });
  }
  return columnArrangement({ hasWorkspace, isSidebarCollapsed, isSettingsOpen });
};
