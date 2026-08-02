import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { cn, Divider, Tooltip } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { NotificationCenter } from '../../../features/notifications/components/NotificationCenter';
import { RunningScriptsIndicator } from '../../../features/scripts/components/RunningScriptsIndicator';
import { OnboardingChip } from '../../../features/onboarding/OnboardingCard';
import { WorkspaceIdentityRow } from '../../../features/workspace/components/WorkspaceIdentityRow';
import { SessionStripCrumbs } from '../../../features/session/components/SessionStripCrumbs';
import { WorkspaceRollupStrip } from './WorkspaceRollupStrip';

const SHOW_COLUMN_LABEL = 'Show sessions column (⌘B)';
const HIDE_COLUMN_LABEL = 'Hide sessions column (⌘B)';

export type AppTopBarProps = {
  onOpenSettings: () => void;
  onOpenBudget: () => void;
  activeStudio: string | null;
  hasWorkspace: boolean;
  hasActiveSession: boolean;
  isSessionSidebarCollapsed: boolean;
  isSessionSidebarHidden: boolean;
  onToggleSessionSidebar: () => void;
  onSessionSidebarAnchorEnter: () => void;
  onSessionSidebarAnchorLeave: () => void;
};

export const AppTopBar = ({
  onOpenSettings,
  onOpenBudget,
  activeStudio,
  hasWorkspace,
  hasActiveSession,
  isSessionSidebarCollapsed,
  isSessionSidebarHidden,
  onToggleSessionSidebar,
  onSessionSidebarAnchorEnter,
  onSessionSidebarAnchorLeave,
}: AppTopBarProps) => {
  const columnActionLabel = isSessionSidebarCollapsed ? SHOW_COLUMN_LABEL : HIDE_COLUMN_LABEL;

  return (
    <>
      <div
        data-tauri-drag-region
        className="relative flex h-9 shrink-0 items-center gap-2 bg-background px-3"
      >
        {hasActiveSession ? (
          <Tooltip content={columnActionLabel}>
            <button
              type="button"
              onClick={onToggleSessionSidebar}
              onPointerEnter={onSessionSidebarAnchorEnter}
              onPointerLeave={onSessionSidebarAnchorLeave}
              data-tauri-drag-region="false"
              aria-label={columnActionLabel}
              className="flex shrink-0 items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {isSessionSidebarCollapsed ? (
                <PanelLeft size={14} aria-hidden />
              ) : (
                <PanelLeftClose size={14} aria-hidden />
              )}
            </button>
          </Tooltip>
        ) : null}

        {hasWorkspace && isSessionSidebarHidden ? (
          <WorkspaceIdentityRow variant="compact" />
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <DogMascot size={15} className="shrink-0 text-foreground" />
            <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center overflow-hidden pl-1">
          {hasActiveSession ? <SessionStripCrumbs /> : null}
        </div>

        <UpdateIndicator variant="pip" />

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
