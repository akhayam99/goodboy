import { Divider } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import type { RunningScript } from '../../../features/scripts/hooks/useRunningScripts';
import { CommandCenter } from './CommandCenter';
import { LimitsStrip } from './LimitsStrip';
import { NowChip } from './NowChip';
import { SidebarToggle, type TopBarSidebar } from './SidebarToggle';
import { SpendButton } from './SpendButton';
import { ThemeToggle } from './ThemeToggle';

type Props = {
  readonly sidebar: TopBarSidebar;
  readonly onOpenSpend: () => void;
  readonly onOpenScript: (run: RunningScript) => void;
  readonly openProviderId?: ProviderId | null;
};

export const AppTopBar = ({ sidebar, onOpenSpend, onOpenScript, openProviderId = null }: Props) => (
  <>
    <div
      data-tauri-drag-region="deep"
      className="@container/topbar grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 bg-chrome pl-(--titlebar-inset) pr-3"
    >
      <div className="col-start-1 flex min-w-0 items-center gap-1">
        <SidebarToggle sidebar={sidebar} />
        <div className="flex min-w-0 max-w-50 items-center">
          <WorkspaceIdentityRow />
        </div>
      </div>

      <div className="col-start-2 flex min-w-0 items-center justify-center">
        <CommandCenter />
      </div>

      <div className="col-start-3 flex items-center justify-end gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <NowChip onOpenScript={onOpenScript} />
          <SpendButton onOpenSpend={onOpenSpend} />
        </div>

        <LimitsStrip openProviderId={openProviderId} />

        <Divider orientation="vertical" className="h-4 shrink-0 self-center" />

        <ThemeToggle />

        <NotificationCenter />
      </div>
    </div>
  </>
);
