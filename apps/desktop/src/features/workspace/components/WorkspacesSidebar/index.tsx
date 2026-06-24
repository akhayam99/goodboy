import { useCallback, useState } from 'react';
import { Divider } from '@goodboy/ui';
import { DollarSign, HelpCircle, Moon, PanelLeftClose, Settings, Sun } from 'lucide-react';
import { NotificationCenter } from '../../../../features/notifications/components/NotificationCenter';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { OnboardingChip } from '../../../onboarding/OnboardingCard';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
} from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { WorkspaceLinkDialog } from '../WorkspaceLinkDialog';
import { SessionActivityBar } from '../SessionActivityBar';
import { FOOTER_ICON_BTN } from './lib';
import { CollapsedSidebarRail } from './parts/CollapsedSidebarRail';
import { QuickActionsRow } from './parts/QuickActionsRow';
import { NoWorkspaceEmpty } from './parts/NoWorkspaceEmpty';

type WorkspacesSidebarProps = {
  onOpenSettings: () => void;
  onOpenPalette: (initialQuery?: string) => void;
  onOpenWorkflows: () => void;
  onOpenLinear: () => void;
  onOpenSentry: () => void;
  onOpenGitlab: () => void;
  onOpenProviders: () => void;
  onOpenGithub: () => void;
  onOpenBudget: () => void;
  collapsed?: boolean;
  onToggleCollapse: () => void;
};

export const WorkspacesSidebar = ({
  onOpenSettings,
  onOpenPalette,
  onOpenWorkflows,
  onOpenLinear,
  onOpenSentry,
  onOpenGitlab,
  onOpenProviders,
  onOpenGithub,
  onOpenBudget,
  collapsed = false,
  onToggleCollapse,
}: WorkspacesSidebarProps) => {
  const currentWorkspace = useCurrentWorkspace();
  const sessions = useSessions();
  const hasLinear = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'linear',
    ),
  );
  const hasSentry = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'sentry',
    ),
  );
  const hasGitlab = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'gitlab',
    ),
  );
  const currentSession = useCurrentSession();
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const onSelectSession = useCallback(
    (id: SessionId) => {
      void setCurrentSession(id);
    },
    [setCurrentSession],
  );
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const activeSessions = sessions;
  const archivedSessions = useAppStore((s) =>
    currentWorkspace ? (s.archivedSessions[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Session>;
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions);
  const onArchivedTabOpen = useCallback(() => {
    if (!currentWorkspace) {
      return;
    }
    void loadArchivedSessions(currentWorkspace.id);
  }, [currentWorkspace, loadArchivedSessions]);

  if (collapsed) {
    return <CollapsedSidebarRail onExpand={onToggleCollapse} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {currentWorkspace ? (
        <>
          <WorkspaceHeader />
          <Divider />
        </>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {!currentWorkspace ? (
          <NoWorkspaceEmpty onAddWorkspace={() => setAddWorkspaceOpen(true)} />
        ) : currentSession ? (
          <SessionActivityBar
            workspaceId={currentWorkspace.id}
            sessions={activeSessions}
            archivedSessions={archivedSessions}
            currentSessionId={currentSession.id}
            onSelectSession={onSelectSession}
            onNewSession={() => window.dispatchEvent(new CustomEvent('goodboy:new-session'))}
            onArchivedTabOpen={onArchivedTabOpen}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-xs text-muted-foreground">
              select a session from the board to see its activity
            </p>
          </div>
        )}
      </div>

      {currentWorkspace ? (
        <>
          <Divider />
          <QuickActionsRow
            onOpenPalette={onOpenPalette}
            onOpenWorkflows={onOpenWorkflows}
            onOpenLinear={onOpenLinear}
            onOpenSentry={onOpenSentry}
            onOpenGitlab={onOpenGitlab}
            onOpenProviders={onOpenProviders}
            onOpenGithub={onOpenGithub}
            linearEnabled={hasLinear}
            sentryEnabled={hasSentry}
            gitlabEnabled={hasGitlab}
            skillsEnabled={WORKSPACE_FEATURES.skills}
          />
        </>
      ) : null}

      <Divider />
      <div className="flex shrink-0 items-center gap-0.5 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="collapse sidebar (⌘B)"
          aria-label="collapse sidebar"
          className={FOOTER_ICON_BTN}
        >
          <PanelLeftClose size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onOpenBudget}
          title="open budget studio"
          aria-label="open budget studio"
          className={FOOTER_ICON_BTN}
        >
          <DollarSign size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
          aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
          className={FOOTER_ICON_BTN}
        >
          {theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
        </button>
        <NotificationCenter />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-guide'))}
          title="getting started"
          aria-label="open getting started guide"
          className={FOOTER_ICON_BTN}
        >
          <HelpCircle size={14} aria-hidden />
        </button>
        <div className="flex-1" />
        <OnboardingChip />
        <button
          type="button"
          onClick={onOpenSettings}
          title="settings (⌘,)"
          aria-label="open settings"
          className={FOOTER_ICON_BTN}
        >
          <Settings size={14} aria-hidden />
        </button>
      </div>

      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
    </div>
  );
};
