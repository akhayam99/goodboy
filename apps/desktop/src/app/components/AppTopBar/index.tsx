import { Moon, Sun } from 'lucide-react';
import { Divider, Tooltip } from '@goodboy/ui';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { ReportIssuePopover } from '../../../features/settings/components/ReportIssuePopover';
import { RunningScriptsIndicator } from '../../../features/scripts/components/RunningScriptsIndicator';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import { BrandBadge } from './BrandBadge';
import { WorkspaceRollupStrip } from './WorkspaceRollupStrip';
import { useThemeStore } from '../../../shared/lib/theme';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  onOpenBudget: () => void;
  showWorkspaceIdentity?: boolean;
};

export const AppTopBar = ({ onOpenBudget, showWorkspaceIdentity = false }: Props) => {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const themeActionLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <>
      <div
        data-tauri-drag-region
        className="relative flex h-9 shrink-0 items-center gap-2 bg-background px-3"
      >
        <BrandBadge />

        {showWorkspaceIdentity ? (
          <>
            <Divider orientation="vertical" className="h-4 shrink-0 self-center" />
            <div className="min-w-0 max-w-56 shrink">
              <WorkspaceIdentityRow />
            </div>
          </>
        ) : null}

        <div className="min-w-0 flex-1" />

        <WorkspaceRollupStrip onOpenBudget={onOpenBudget} />

        <Divider orientation="vertical" className="h-4 shrink-0 self-center" />

        <div className="flex shrink-0 items-center gap-0.5">
          <RunningScriptsIndicator />
          <ReportIssuePopover />
          <NotificationCenter />
          <Tooltip content={themeActionLabel}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={themeActionLabel}
              className="flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {theme === 'dark' ? (
                <Moon size={ICON_SIZE.control} aria-hidden />
              ) : (
                <Sun size={ICON_SIZE.control} aria-hidden />
              )}
            </button>
          </Tooltip>
          <OnboardingChip />
        </div>
      </div>
      <Divider />
    </>
  );
};
