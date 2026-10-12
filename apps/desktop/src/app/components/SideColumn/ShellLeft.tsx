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

  if (!isPeek && arrangement.leftSlot === 'rail') {
    return (
      <ColumnRail
        scope={arrangement.columnScope}
        workspaceId={workspaceId}
        currentSessionId={currentSessionId}
        place={place}
        onToggle={onToggle}
        actions={actions}
      />
    );
  }
  return (
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
};
