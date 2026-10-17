import type { ProviderId } from '@goodboy/types';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import { RepoEntry } from '../../../features/workspace/components/RepoEntry';
import { useCurrentWorkspace } from '../../../store';
import type { RunningScript } from '../../../features/scripts/hooks/useRunningScripts';
import { ColumnToggleButton } from '../SideColumn/ColumnToggleButton';
import { CommandCenter } from './CommandCenter';
import { LimitsStrip } from './LimitsStrip';
import { MonitoringSignal } from './MonitoringSignal';
import { NowChip } from './NowChip';
import { NavCluster } from './NavCluster';
import { SpendButton } from './SpendButton';
import { ThemeToggle } from './ThemeToggle';

type SidebarToggle = {
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly onOpenSpend: () => void;
  readonly onOpenScript: (run: RunningScript) => void;
  readonly openProviderId?: ProviderId | null;
  readonly sidebar?: SidebarToggle;
};

export const AppTopBar = ({ onOpenSpend, onOpenScript, openProviderId = null, sidebar }: Props) => {
  const workspace = useCurrentWorkspace();
  return (
    <>
      <div
        data-tauri-drag-region="deep"
        data-top-bar=""
        className="@container/topbar grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 bg-chrome px-2"
      >
        <div className="col-start-1 flex min-w-0 items-center gap-1">
          <div className="flex min-w-0 max-w-50 items-center">
            <WorkspaceIdentityRow />
          </div>
          {workspace === null || workspace === undefined ? null : (
            <RepoEntry workspaceId={workspace.id} />
          )}
        </div>

        <div className="col-start-2 flex min-w-0 items-center justify-center gap-2">
          {sidebar === undefined ? null : (
            <ColumnToggleButton isCollapsed={sidebar.isCollapsed} onToggle={sidebar.onToggle} />
          )}
          <NavCluster />
          <CommandCenter />
        </div>

        <div className="col-start-3 flex items-center justify-end gap-1">
          <NowChip onOpenScript={onOpenScript} />

          <LimitsStrip openProviderId={openProviderId} />

          <MonitoringSignal />

          <SpendButton onOpenSpend={onOpenSpend} />

          <ThemeToggle />

          <NotificationCenter />
        </div>
      </div>
    </>
  );
};
