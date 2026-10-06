import type { ProviderId } from '@goodboy/types';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import type { RunningScript } from '../../../features/scripts/hooks/useRunningScripts';
import type { ShellMode } from '../../shellArrangement';
import { CommandCenter } from './CommandCenter';
import { ImpactButton } from './ImpactButton';
import { LimitsStrip } from './LimitsStrip';
import { NowChip } from './NowChip';
import { NavCluster } from './NavCluster';
import { SpendButton } from './SpendButton';
import { ThemeToggle } from './ThemeToggle';

type Props = {
  readonly onOpenSpend: () => void;
  readonly onOpenScript: (run: RunningScript) => void;
  readonly onOpenImpact?: () => void;
  readonly openProviderId?: ProviderId | null;
  readonly mode?: ShellMode;
};

export const AppTopBar = ({
  onOpenSpend,
  onOpenScript,
  onOpenImpact,
  openProviderId = null,
  mode = 'column',
}: Props) => (
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
      </div>

      <div className="col-start-2 flex min-w-0 items-center justify-center gap-2">
        <NavCluster hasDoors={mode === 'classic'} />
        <CommandCenter />
      </div>

      <div className="col-start-3 flex items-center justify-end gap-1">
        <div className="flex shrink-0 items-center gap-1">
          <NowChip onOpenScript={onOpenScript} />
          <SpendButton onOpenSpend={onOpenSpend} />
        </div>

        <LimitsStrip openProviderId={openProviderId} opensProvidersMenu={mode === 'column'} />

        <ThemeToggle />

        {mode === 'column' && onOpenImpact !== undefined ? (
          <ImpactButton onOpenImpact={onOpenImpact} />
        ) : null}

        <NotificationCenter />
      </div>
    </div>
  </>
);
