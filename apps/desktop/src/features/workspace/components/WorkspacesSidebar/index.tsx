import { useCallback, useState } from 'react';
import { Divider, ScrollArea } from '@goodboy/ui';
import { DollarSign, HelpCircle, Moon, PanelLeftClose, Settings, Sun } from 'lucide-react';
import { GuideDialog } from '../../../settings/components/GuideDialog';
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
import { SessionDetailPanel, SessionMetaFooter } from '../SessionDetailPanel';
import { FOOTER_ICON_BTN } from './lib';
import { CollapsedSidebarRail } from './parts/CollapsedSidebarRail';
import { QuickActionsRow } from './parts/QuickActionsRow';
import { SidebarLogo } from './parts/SidebarLogo';
import { SidebarDetailHint } from './parts/SidebarDetailHint';
import { NoWorkspaceEmpty } from './parts/NoWorkspaceEmpty';
import { AgentsSection } from './parts/AgentsSection';

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
  const [guideOpen, setGuideOpen] = useState(false);

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
      <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-2">
        <SidebarLogo />
        <div className="flex-1" />
        <OnboardingChip />
        <div className="flex items-center gap-0.5">
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
            onClick={() => setGuideOpen(true)}
            title="getting started"
            aria-label="open getting started guide"
            className={FOOTER_ICON_BTN}
          >
            <HelpCircle size={14} aria-hidden />
          </button>
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
      </div>

      <Divider />

      {currentWorkspace ? (
        <>
          <WorkspaceHeader />
          <Divider />
        </>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {currentWorkspace ? (
          (() => {
            const totalSessions = activeSessions.length + archivedSessions.length;
            const hasAnySession = totalSessions > 0;
            return (
              <div className="mx-2 my-3 flex min-h-0 flex-1 overflow-hidden">
                <div className="w-2/5 min-w-28 max-w-44 shrink-0 overflow-hidden">
                  <SessionActivityBar
                    workspaceId={currentWorkspace.id}
                    sessions={activeSessions}
                    archivedSessions={archivedSessions}
                    currentSessionId={currentSession?.id ?? null}
                    onSelectSession={onSelectSession}
                    onNewSession={() =>
                      window.dispatchEvent(new CustomEvent('goodboy:new-session'))
                    }
                    onArchivedTabOpen={onArchivedTabOpen}
                  />
                </div>
                <Divider orientation="vertical" className="mx-1.5" />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  {currentSession ? (
                    <>
                      <SessionDetailPanel
                        session={currentSession}
                        onOpenSessionSettings={() =>
                          window.dispatchEvent(new CustomEvent('goodboy:open-session-settings'))
                        }
                      />
                      <Divider />
                      <ScrollArea className="min-h-0 flex-1">
                        <AgentsSection task={currentSession} />
                      </ScrollArea>
                      <SessionMetaFooter session={currentSession} />
                    </>
                  ) : (
                    <SidebarDetailHint hasAnySession={hasAnySession} />
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <NoWorkspaceEmpty onAddWorkspace={() => setAddWorkspaceOpen(true)} />
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

      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
      {guideOpen ? <GuideDialog open onClose={() => setGuideOpen(false)} /> : null}
    </div>
  );
};
