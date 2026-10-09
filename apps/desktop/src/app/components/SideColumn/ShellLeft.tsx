import type { SessionId, WorkspaceId } from '@goodboy/types';
import { SessionNavSidebar } from '../../../features/session/components/SessionNavSidebar';
import { CollapsedRail } from '../../../features/session/components/SessionNavSidebar/parts/CollapsedRail';
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

  if (arrangement.mode === 'classic') {
    if (isPeek) {
      return (
        <SessionNavSidebar
          currentSessionId={currentSessionId}
          {...(onNavigate !== undefined && { onNavigate })}
          isCollapsed={isCollapsed}
          onToggleSidebar={onToggle}
        />
      );
    }
    if (arrangement.leftSlot === 'none') {
      return null;
    }
    return arrangement.leftSlot === 'rail' ? (
      <CollapsedRail onToggleSidebar={onToggle} isDraftShown={isDraftShown} />
    ) : (
      <SessionNavSidebar currentSessionId={currentSessionId} onToggleSidebar={onToggle} />
    );
  }

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
