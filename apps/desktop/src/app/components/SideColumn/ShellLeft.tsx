import { FoldLayers, LEFT_SIDEBAR_DEFAULT } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useColumnPlace } from '../../hooks/useColumnPlace';
import type { ShellArrangement } from '../../shellArrangement';
import { ColumnRail } from './ColumnRail';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';
import { SideColumn } from './index';

type Props = {
  readonly arrangement: ShellArrangement;
  readonly workspaceId: WorkspaceId | null;
  readonly currentSessionId: SessionId | null;
  readonly isDraftShown: boolean;
  readonly actions: ColumnActions;
  readonly onToggle: () => void;
  readonly variant?: 'pinned' | 'peek';
  readonly onNavigate?: () => void;
  readonly settingsSlotRef?: (node: HTMLDivElement | null) => void;
  readonly placeOverride?: ColumnPlace;
};

const OPEN_WIDTH = `var(--goodboy-left-sidebar-width, ${LEFT_SIDEBAR_DEFAULT}px)`;

export const ShellLeft = ({
  arrangement,
  workspaceId,
  currentSessionId,
  isDraftShown,
  actions,
  onToggle,
  variant = 'pinned',
  onNavigate,
  settingsSlotRef,
  placeOverride,
}: Props) => {
  const storePlace = useColumnPlace();
  const place = placeOverride === undefined ? storePlace : placeOverride;
  const isPeek = variant === 'peek';
  const isCollapsed = arrangement.leftSidebarCollapsed;
  const column = (
    <SideColumn
      scope={arrangement.columnScope}
      workspaceId={workspaceId}
      currentSessionId={currentSessionId}
      place={place}
      isCollapsed={isCollapsed}
      actions={actions}
      onToggle={onToggle}
      isPeek={isPeek}
      {...(onNavigate !== undefined && { onNavigate })}
      {...(!isPeek && settingsSlotRef !== undefined && { settingsSlotRef })}
    />
  );
  if (isPeek) {
    return column;
  }
  return (
    <FoldLayers
      isFolded={arrangement.leftSlot === 'rail'}
      openWidth={OPEN_WIDTH}
      open={column}
      folded={
        <ColumnRail
          scope={arrangement.columnScope}
          workspaceId={workspaceId}
          currentSessionId={currentSessionId}
          place={place}
          onToggle={onToggle}
          actions={actions}
        />
      }
    />
  );
};
