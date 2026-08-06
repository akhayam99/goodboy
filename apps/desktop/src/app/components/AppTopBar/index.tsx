import { Moon, PanelLeft, PanelLeftClose, Sun } from 'lucide-react';
import { cn, Divider, Tooltip } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { RunningScriptsIndicator } from '../../../features/scripts/components/RunningScriptsIndicator';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import { SessionStripCrumbs } from '../../../features/session/components/SessionStripCrumbs';
import { WorkspaceRollupStrip } from './WorkspaceRollupStrip';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { useThemeStore } from '../../../shared/lib/theme';

const SHOW_COLUMN_LABEL = `Show sessions column (${shortcutGlyphs('column.toggle')})`;
const HIDE_COLUMN_LABEL = `Hide sessions column (${shortcutGlyphs('column.toggle')})`;

type Props = {
  onOpenBudget: () => void;
  hasWorkspace: boolean;
  hasActiveSession: boolean;
  isSessionSidebarCollapsed: boolean;
  isSessionSidebarPeeking: boolean;
  onToggleSessionSidebar: () => void;
  onSessionSidebarAnchorEnter: () => void;
  onSessionSidebarAnchorLeave: () => void;
};

export const AppTopBar = ({
  onOpenBudget,
  hasWorkspace,
  hasActiveSession,
  isSessionSidebarCollapsed,
  isSessionSidebarPeeking,
  onToggleSessionSidebar,
  onSessionSidebarAnchorEnter,
  onSessionSidebarAnchorLeave,
}: Props) => {
  const columnActionLabel = isSessionSidebarCollapsed ? SHOW_COLUMN_LABEL : HIDE_COLUMN_LABEL;
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const themeActionLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <>
      <div
        data-tauri-drag-region
        className="relative flex h-9 shrink-0 items-center gap-2 bg-background px-3"
      >
        <DogMascot size={15} className="shrink-0 text-foreground" />

        {hasActiveSession ? (
          <Tooltip content={columnActionLabel}>
            <button
              type="button"
              onClick={onToggleSessionSidebar}
              onPointerEnter={onSessionSidebarAnchorEnter}
              onPointerLeave={onSessionSidebarAnchorLeave}
              data-tauri-drag-region="false"
              aria-label={columnActionLabel}
              aria-pressed={isSessionSidebarPeeking}
              className={cn(
                'flex shrink-0 items-center justify-center rounded p-1.5 transition-colors',
                isSessionSidebarPeeking
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {isSessionSidebarCollapsed ? (
                <PanelLeft size={14} aria-hidden />
              ) : (
                <PanelLeftClose size={14} aria-hidden />
              )}
            </button>
          </Tooltip>
        ) : null}

        {hasWorkspace ? (
          <WorkspaceIdentityRow />
        ) : (
          <span className="shrink-0 text-xs font-semibold tracking-tight text-foreground">
            Goodboy
          </span>
        )}

        <div className="flex min-w-0 flex-1 items-center overflow-hidden pl-1">
          {hasActiveSession ? <SessionStripCrumbs /> : null}
        </div>

        <WorkspaceRollupStrip onOpenBudget={onOpenBudget} />

        <Divider orientation="vertical" className="h-4 shrink-0 self-center" />

        <div className="flex shrink-0 items-center gap-0.5">
          <RunningScriptsIndicator />
          <NotificationCenter />
          <Tooltip content={themeActionLabel}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={themeActionLabel}
              className="flex items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {theme === 'dark' ? <Moon size={14} aria-hidden /> : <Sun size={14} aria-hidden />}
            </button>
          </Tooltip>
          <OnboardingChip />
        </div>
      </div>
      <Divider />
    </>
  );
};
