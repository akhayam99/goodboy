import { cn, Divider, Tooltip } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { RunningScriptsIndicator } from '../../../features/scripts/components/RunningScriptsIndicator';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';
import { WorkspaceRollupStrip } from './WorkspaceRollupStrip';

export type AppTopBarProps = {
  onOpenSettings: () => void;
  onOpenBudget: () => void;
  activeStudio: string | null;
};

export const AppTopBar = ({ onOpenSettings, onOpenBudget, activeStudio }: AppTopBarProps) => {
  return (
    <>
      <div
        data-tauri-drag-region
        className="relative flex h-9 shrink-0 items-center gap-2 bg-background px-3"
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <DogMascot size={15} className="shrink-0 text-foreground" />
          <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
        </div>

        <div className="min-w-0 flex-1" />

        <UpdateIndicator variant="pip" />

        <div className="min-w-0 flex-1" />

        <WorkspaceRollupStrip onOpenBudget={onOpenBudget} />

        <Divider orientation="vertical" className="h-4 shrink-0 self-center" />

        <div className="flex shrink-0 items-center gap-0.5">
          <RunningScriptsIndicator />
          <NotificationCenter />
          <OnboardingChip />
          <Tooltip content="settings (⌘,)">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="open settings"
              className={cn(
                'flex items-center justify-center rounded p-1.5 transition-colors',
                activeStudio === 'settings'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <CONCEPT_ICONS.settings size={14} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
      <Divider />
    </>
  );
};
