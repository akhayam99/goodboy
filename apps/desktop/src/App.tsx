import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import type { ProviderId, SessionId } from '@goodboy/types';
import { CommandPalette } from './features/session/components/CommandPalette';
import { BootSplash } from './app/components/BootSplash';
import { ChatView } from './features/chat/components/ChatView';
import { ContextPanel } from './features/context/components/ContextPanel';
import { DeleteSessionDialog } from './features/session/components/DeleteSessionDialog';
import { ArchiveSessionDialog } from './features/session/components/ArchiveSessionDialog';
import { SettingsDialog } from './features/settings/components/SettingsDialog';
import { ToastProvider } from './app/components/Toast';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { ProviderModalHost } from './features/providers/components/ProviderModalHost';
import { WorkspacesSidebar } from './features/workspace/components/WorkspacesSidebar';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { WorkspaceLinkDialog } from './features/workspace/components/WorkspaceLinkDialog';
import { WorkspaceLauncher } from './features/workspace/components/WorkspaceLauncher';
import { WorkspaceSwitcher } from './features/workspace/components/WorkspaceSwitcher';
import { isMainWindow } from './features/workspace/window';
import { WorkflowStudio } from './features/workflows/components/WorkflowStudio';
import { GitHubStudio } from './features/github/components/GitHubStudio';
import { LinearStudio } from './features/integrations/linear/LinearStudio';
import { ProviderStudio } from './features/providers/components/ProviderStudio';
import { BudgetStudio } from './features/budget/components/BudgetStudio';
import type { BudgetScope } from './features/budget/components/BudgetStudio/lib';
import { DiffViewerDialog } from './features/permissions/components/DiffViewerDialog';
import { ghCommitDiff } from './features/github/github';
import { worktreeDiffCommit } from './features/worktree/worktree';
import { DogMascot } from './shared/components/DogMascot';
import { OnboardingCard } from './features/onboarding/OnboardingCard';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { markStepComplete } from './features/onboarding/onboarding-store';
import { BookOpen, MessageSquare, MessagesSquare } from 'lucide-react';
import { useKeyboardShortcut } from './shared/hooks/useKeyboardShortcut';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionById,
  useSessions,
  useSessionSlots,
  useWorkspaces,
} from './store';
import { refreshPricingTable } from './features/providers/provider-pricing';
import { useGithubPolling } from './features/github/hooks/useGithubPolling';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { STORAGE_PREFIXES } from './shared/lib/storage-keys';
import { openUrl } from './shared/lib/editor';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from './shared/lib/zoom';

const CONTEXT_PANEL_KEY = (id: SessionId): string => `${STORAGE_PREFIXES.contextPanelOpen}${id}`;

const ZOOM_ACTIONS: Record<string, () => Promise<void>> = {
  '=': zoomIn,
  '+': zoomIn,
  '-': zoomOut,
  _: zoomOut,
  '0': zoomReset,
};

const KEEP_ALIVE_CAP = 5;

function readPersistedContextOpen(id: SessionId, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(CONTEXT_PANEL_KEY(id));
    if (raw === null) {
      return fallback;
    }
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writePersistedContextOpen(id: SessionId, open: boolean): void {
  try {
    localStorage.setItem(CONTEXT_PANEL_KEY(id), open ? '1' : '0');
  } catch {
    // localStorage unavailable, ignore
  }
}

export const App = () => {
  const hydrate = useAppStore((s) => s.hydrate);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const hydrated = useAppStore((s) => s.hydrated);
  const bootPhase = useAppStore((s) => s.bootPhase);
  const error = useAppStore((s) => s.error);
  const [splashFinished, setSplashFinished] = useState(false);
  const workspaces = useWorkspaces();
  const hasWorkspaces = workspaces.length > 0;
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const slots = useSessionSlots(currentSession?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(
    undefined,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefix, setPalettePrefix] = useState('');
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [workflowStudioOpen, setWorkflowStudioOpen] = useState(false);
  const [linearStudioOpen, setLinearStudioOpen] = useState(false);
  const [linearStudioFocus, setLinearStudioFocus] = useState<string | null>(null);
  const [providerStudioOpen, setProviderStudioOpen] = useState(false);
  const [providerStudioFocus, setProviderStudioFocus] = useState<ProviderId | null>(null);
  const [githubStudioOpen, setGithubStudioOpen] = useState(false);
  const [githubStudioSession, setGithubStudioSession] = useState<SessionId | null>(null);
  const [githubStudioPrNumber, setGithubStudioPrNumber] = useState<number | null>(null);
  const [githubStudioThreadId, setGithubStudioThreadId] = useState<string | null>(null);
  const [budgetStudioOpen, setBudgetStudioOpen] = useState(false);
  const [budgetStudioScope, setBudgetStudioScope] = useState<BudgetScope | undefined>(undefined);
  const [commitDiff, setCommitDiff] = useState<{ repo: string; sha: string } | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(
    () =>
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('goodboy:left-sidebar-collapsed') === '1',
  );
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [contextHydratedFor, setContextHydratedFor] = useState<SessionId | null>(null);
  const [keepAliveIds, setKeepAliveIds] = useState<ReadonlyArray<SessionId>>([]);

  useEffect(() => {
    void hydrate();
    void refreshPricingTable();
    if (import.meta.env.PROD) {
      void checkForUpdates();
    }
  }, [hydrate, checkForUpdates]);

  useGithubPolling();
  useProviderRefreshOnFocus();
  useUpdaterPolling();
  useWindowPresence();

  useEffect(() => {
    void applyStoredZoom();
    const onShortcut = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        window.location.reload();
        return;
      }
      const action = ZOOM_ACTIONS[e.key];
      if (!action) {
        return;
      }
      e.preventDefault();
      void action();
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      setSettingsInitialSection(detail?.section);
      setSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-settings', handler);
    return () => window.removeEventListener('goodboy:open-settings', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sessionId?: SessionId; prNumber?: number; threadId?: string }>
      ).detail;
      setGithubStudioSession(detail?.sessionId ?? null);
      setGithubStudioPrNumber(detail?.prNumber ?? null);
      setGithubStudioThreadId(detail?.threadId ?? null);
      setGithubStudioOpen(true);
    };
    window.addEventListener('goodboy:open-github-studio', handler);
    return () => window.removeEventListener('goodboy:open-github-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ providerId?: ProviderId }>).detail;
      setProviderStudioFocus(detail?.providerId ?? null);
      setProviderStudioOpen(true);
    };
    window.addEventListener('goodboy:open-provider-studio', handler);
    return () => window.removeEventListener('goodboy:open-provider-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: BudgetScope }>).detail;
      setBudgetStudioScope(detail?.scope);
      setBudgetStudioOpen(true);
    };
    window.addEventListener('goodboy:open-budget-studio', handler);
    return () => window.removeEventListener('goodboy:open-budget-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setLinearStudioFocus(detail?.issueExternalId ?? null);
      setLinearStudioOpen(true);
    };
    window.addEventListener('goodboy:open-linear-studio', handler);
    return () => window.removeEventListener('goodboy:open-linear-studio', handler);
  }, []);

  useEffect(() => {
    const handler = () => setAddWorkspaceOpen(true);
    window.addEventListener('goodboy:add-workspace', handler);
    return () => window.removeEventListener('goodboy:add-workspace', handler);
  }, []);

  useEffect(() => {
    const handler = () => setSwitcherOpen(true);
    window.addEventListener('goodboy:open-workspace-switcher', handler);
    return () => window.removeEventListener('goodboy:open-workspace-switcher', handler);
  }, []);

  useEffect(() => {
    const COMMIT_RE = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/commit\/([0-9a-f]{7,40})/i;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      const href = anchor?.getAttribute('href');
      if (!href) {
        return;
      }
      const commit = href.match(COMMIT_RE);
      if (commit) {
        e.preventDefault();
        setCommitDiff({ repo: commit[1] as string, sha: commit[2] as string });
        return;
      }
      if (/^(https?:|mailto:)/i.test(href)) {
        e.preventDefault();
        void openUrl(href);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      e.preventDefault();
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      dialogs[dialogs.length - 1]?.close();
    };
    document.addEventListener('keydown', onEsc, { capture: true });
    return () => document.removeEventListener('keydown', onEsc, { capture: true });
  }, []);

  useEffect(() => {
    if (!currentSession) {
      setContextOpen(false);
      setContextHydratedFor(null);
      return;
    }
    if (contextHydratedFor === currentSession.id) {
      return;
    }
    const enabledSlots = slots.filter((s) => s.enabled && s.value.length > 0).length;
    const fallback = enabledSlots > 0;
    setContextOpen(readPersistedContextOpen(currentSession.id, fallback));
    setContextHydratedFor(currentSession.id);
  }, [currentSession, slots, contextHydratedFor]);

  const onToggleContext = () => {
    if (!currentSession) {
      return;
    }
    setContextOpen((open) => {
      const next = !open;
      writePersistedContextOpen(currentSession.id, next);
      return next;
    });
  };

  useEffect(() => {
    setKeepAliveIds([]);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const id = currentSession?.id ?? null;
    if (!id) {
      return;
    }
    setKeepAliveIds((prev) => {
      if (prev[prev.length - 1] === id) {
        return prev;
      }
      const filtered = prev.filter((x) => x !== id);
      const next = [...filtered, id];
      return next.length > KEEP_ALIVE_CAP ? next.slice(next.length - KEEP_ALIVE_CAP) : next;
    });
  }, [currentSession?.id]);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openDeleteSession = useCallback(() => {
    if (currentSession) {
      setDeleteOpen(true);
    }
  }, [currentSession]);
  const openArchiveSession = useCallback(() => {
    if (currentSession) {
      setArchiveOpen(true);
    }
  }, [currentSession]);

  useEffect(() => {
    const handler = () => {
      if (currentSession) {
        setDeleteOpen(true);
      }
    };
    window.addEventListener('goodboy:delete-session', handler);
    return () => window.removeEventListener('goodboy:delete-session', handler);
  }, [currentSession]);

  useEffect(() => {
    const handler = () => {
      if (currentSession) {
        setArchiveOpen(true);
      }
    };
    window.addEventListener('goodboy:archive-session', handler);
    return () => window.removeEventListener('goodboy:archive-session', handler);
  }, [currentSession]);
  const openShortcutHelp = useCallback(() => {
    setSettingsInitialSection('shortcuts');
    setSettingsOpen(true);
  }, []);
  const openPalette = useCallback((prefix = '') => {
    setPalettePrefix(prefix);
    setPaletteOpen(true);
    markStepComplete('palette');
  }, []);
  const toggleLeftSidebar = useCallback(() => {
    setLeftCollapsed((v) => {
      const next = !v;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('goodboy:left-sidebar-collapsed', next ? '1' : '0');
      }
      return next;
    });
  }, []);

  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const currentWorkspaceSessions = useSessions();

  const selectWorkspaceByIndex = useCallback(
    (idx: number) => {
      const w = workspaces[idx];
      if (w) {
        void openWorkspace(w.id, w.name);
      }
    },
    [workspaces, openWorkspace],
  );

  const navigateSession = useCallback(
    (delta: number) => {
      const list = currentWorkspaceSessions;
      if (list.length === 0) {
        return;
      }
      if (!currentSession) {
        const target = delta >= 0 ? list[0] : list[list.length - 1];
        if (target) {
          void setCurrentSession(target.id);
        }
        return;
      }
      const idx = list.findIndex((s) => s.id === currentSession.id);
      if (idx === -1) {
        return;
      }
      const next = list[idx + delta];
      if (next) {
        void setCurrentSession(next.id);
      }
    },
    [currentWorkspaceSessions, currentSession, setCurrentSession],
  );

  const openNewSession = useCallback(() => {
    if (!currentWorkspace) {
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:new-session'));
  }, [currentWorkspace]);

  const openModelPicker = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-model-picker'));
  }, []);

  const openPermissionPicker = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-permission-picker'));
  }, []);

  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const sessionWorktrees = useAppStore((s) => s.sessionWorktrees);

  const commitDiffLoader = useCallback(async () => {
    if (!commitDiff) {
      return '';
    }
    const worktree = currentSessionId ? (sessionWorktrees[currentSessionId]?.[0] ?? null) : null;
    if (worktree) {
      try {
        return await worktreeDiffCommit(worktree, commitDiff.sha);
      } catch {
        void 0;
      }
    }
    return ghCommitDiff(commitDiff.repo, commitDiff.sha);
  }, [commitDiff, currentSessionId, sessionWorktrees]);

  useKeyboardShortcut('cmd+,', openSettings);
  useKeyboardShortcut('cmd+/', openShortcutHelp);
  useKeyboardShortcut('cmd+.', openDeleteSession);
  useKeyboardShortcut('cmd+shift+a', openArchiveSession);
  useKeyboardShortcut('cmd+k', () => openPalette());
  useKeyboardShortcut('cmd+o', () => setSwitcherOpen(true));
  useKeyboardShortcut('cmd+b', toggleLeftSidebar);
  useKeyboardShortcut('cmd+n', openNewSession, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+[', () => navigateSession(-1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+]', () => navigateSession(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+k', openModelPicker);
  useKeyboardShortcut('cmd+shift+p', openPermissionPicker);
  useKeyboardShortcut('cmd+1', () => selectWorkspaceByIndex(0), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+2', () => selectWorkspaceByIndex(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+3', () => selectWorkspaceByIndex(2), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+4', () => selectWorkspaceByIndex(3), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+5', () => selectWorkspaceByIndex(4), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+6', () => selectWorkspaceByIndex(5), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+7', () => selectWorkspaceByIndex(6), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+8', () => selectWorkspaceByIndex(7), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+9', () => selectWorkspaceByIndex(8), { ignoreInInputs: false });

  const renderedSessionIds = useMemo<ReadonlyArray<SessionId>>(() => {
    const cid = currentSession?.id ?? null;
    if (!cid) {
      return keepAliveIds;
    }
    if (keepAliveIds.includes(cid)) {
      return keepAliveIds;
    }
    const merged = [...keepAliveIds, cid];
    return merged.length > KEEP_ALIVE_CAP ? merged.slice(merged.length - KEEP_ALIVE_CAP) : merged;
  }, [keepAliveIds, currentSession?.id]);

  const deferredRenderedIds = useDeferredValue(renderedSessionIds);
  const deferredActiveId = useDeferredValue(currentSession?.id ?? null);

  if (!hydrated || !splashFinished) {
    return (
      <BootSplash
        phase={bootPhase}
        error={error}
        onRetry={() => void hydrate()}
        onFinished={() => setSplashFinished(true)}
      />
    );
  }

  if (hasWorkspaces && !currentWorkspace && isMainWindow()) {
    return (
      <ToastProvider>
        <NotificationToastBridge />
        <WorkspaceLauncher />
        {addWorkspaceOpen ? (
          <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
        ) : null}
        {switcherOpen ? <WorkspaceSwitcher onClose={() => setSwitcherOpen(false)} /> : null}
      </ToastProvider>
    );
  }

  const contextCollapsed = !contextOpen;
  const rightSidebarCollapsed = !currentSession || contextCollapsed;

  return (
    <ToastProvider>
      <NotificationToastBridge />
      <AppShell
        leftSidebarCollapsed={leftCollapsed}
        leftSidebar={
          hasWorkspaces ? (
            <WorkspacesSidebar
              onOpenSettings={openSettings}
              onOpenPalette={openPalette}
              onOpenWorkflows={() => setWorkflowStudioOpen(true)}
              onOpenLinear={() => {
                setLinearStudioFocus(null);
                setLinearStudioOpen(true);
              }}
              onOpenProviders={() => {
                setProviderStudioFocus(null);
                setProviderStudioOpen(true);
              }}
              onOpenGithub={() => {
                setGithubStudioSession(currentSession?.id ?? null);
                setGithubStudioOpen(true);
              }}
              onOpenBudget={() => {
                setBudgetStudioScope({ kind: 'overview' });
                setBudgetStudioOpen(true);
              }}
              collapsed={leftCollapsed}
              onToggleCollapse={toggleLeftSidebar}
            />
          ) : undefined
        }
        main={
          <div className="relative h-full w-full">
            {error ? (
              <p className="p-6 text-sm text-danger">init error: {error}</p>
            ) : currentSession ? (
              <div className="relative h-full w-full">
                {deferredRenderedIds.map((id) => (
                  <KeepAliveChatPanel key={id} sessionId={id} isActive={id === deferredActiveId} />
                ))}
              </div>
            ) : (
              <EmptyState
                hasWorkspace={Boolean(currentWorkspace)}
                onAddWorkspace={() => setAddWorkspaceOpen(true)}
              />
            )}

            <OnboardingCard />
          </div>
        }
        rightSidebar={
          currentSession ? (
            <div className="relative h-full w-full">
              {deferredRenderedIds.map((id) => (
                <KeepAliveContextPanel
                  key={id}
                  sessionId={id}
                  isActive={id === deferredActiveId}
                  collapsed={contextCollapsed}
                  onCollapse={onToggleContext}
                  onExpand={onToggleContext}
                />
              ))}
            </div>
          ) : null
        }
        rightSidebarCollapsed={rightSidebarCollapsed}
      />

      {settingsOpen ? (
        <SettingsDialog
          open
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialSection(undefined);
          }}
          initialSection={settingsInitialSection}
        />
      ) : null}
      {paletteOpen ? (
        <CommandPalette
          initialQuery={palettePrefix}
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => {
            setSettingsOpen(true);
            setPaletteOpen(false);
          }}
          onNewSession={() => setPaletteOpen(false)}
          onOpenShortcutHelp={() => {
            openShortcutHelp();
            setPaletteOpen(false);
          }}
        />
      ) : null}
      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
      {workflowStudioOpen && currentWorkspace ? (
        <WorkflowStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={() => setWorkflowStudioOpen(false)}
        />
      ) : null}
      {githubStudioOpen && currentWorkspace ? (
        <GitHubStudio
          workspaceName={currentWorkspace.name}
          initialSessionId={githubStudioSession}
          initialPrNumber={githubStudioPrNumber}
          initialThreadId={githubStudioThreadId}
          onClose={() => setGithubStudioOpen(false)}
        />
      ) : null}
      {providerStudioOpen && currentWorkspace ? (
        <ProviderStudio
          workspaceName={currentWorkspace.name}
          initialFocus={providerStudioFocus}
          onClose={() => setProviderStudioOpen(false)}
        />
      ) : null}
      {budgetStudioOpen && currentWorkspace ? (
        <BudgetStudio
          workspaceName={currentWorkspace.name}
          initialScope={budgetStudioScope}
          onClose={() => setBudgetStudioOpen(false)}
        />
      ) : null}
      {linearStudioOpen && currentWorkspace ? (
        <LinearStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialIssueId={linearStudioFocus}
          onClose={() => setLinearStudioOpen(false)}
        />
      ) : null}
      {commitDiff ? (
        <DiffViewerDialog
          open
          onClose={() => setCommitDiff(null)}
          title={`commit ${commitDiff.sha.slice(0, 7)}`}
          loader={commitDiffLoader}
        />
      ) : null}
      {currentSession && deleteOpen ? (
        <DeleteSessionDialog session={currentSession} open onClose={() => setDeleteOpen(false)} />
      ) : null}
      {currentSession && archiveOpen ? (
        <ArchiveSessionDialog session={currentSession} open onClose={() => setArchiveOpen(false)} />
      ) : null}
      {switcherOpen ? <WorkspaceSwitcher onClose={() => setSwitcherOpen(false)} /> : null}

      <ProviderModalHost />
      <OnboardingWizard />
    </ToastProvider>
  );
};

type KeepAliveChatPanelProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
};

function KeepAliveChatPanel({ sessionId, isActive }: KeepAliveChatPanelProps) {
  const session = useSessionById(sessionId);
  if (!session) {
    return null;
  }
  return (
    <div hidden={!isActive} className="absolute inset-0">
      <ChatView session={session} isActive={isActive} />
    </div>
  );
}

type KeepAliveContextPanelProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
};

function KeepAliveContextPanel({
  sessionId,
  isActive,
  collapsed,
  onCollapse,
  onExpand,
}: KeepAliveContextPanelProps) {
  const session = useSessionById(sessionId);
  if (!session) {
    return null;
  }
  return (
    <div hidden={!isActive} className="absolute inset-0">
      <ContextPanel
        session={session}
        isActive={isActive}
        collapsed={collapsed}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    </div>
  );
}

function EmptyState({
  hasWorkspace,
  onAddWorkspace,
}: {
  hasWorkspace: boolean;
  onAddWorkspace: () => void;
}) {
  if (!hasWorkspace) {
    return <OnboardingScreen onAddWorkspace={onAddWorkspace} />;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 40%, var(--color-background) 100%)',
        }}
        aria-hidden
      />
      <div className="relative flex max-w-md flex-col items-center gap-6 text-center">
        <EmptyStateLogo />
        <div className="flex flex-col gap-2.5">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Pick up where you left off
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Create a new session from the sidebar, or jump back into an existing one. Each session
            lives in its own worktree.
          </p>
        </div>
        <KeyboardHints hasWorkspace />
      </div>
    </div>
  );
}

function OnboardingScreen({ onAddWorkspace }: { onAddWorkspace: () => void }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 40%, var(--color-background) 100%)',
        }}
        aria-hidden
      />

      <div className="relative flex max-w-2xl flex-col items-center gap-10 text-center">
        <EmptyStateLogo />

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to Goodboy
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Point at a git repo to create your first workspace. Every session spins up its own
            worktree and branch, your main checkout stays untouched.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddWorkspace}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Add workspace
        </button>

        <AppLayoutPreview />
      </div>
    </div>
  );
}

function AppLayoutPreview() {
  return (
    <div className="flex w-full max-w-2xl gap-3">
      <div className="flex w-[30%] flex-col items-center gap-3 rounded-lg border border-border-soft/30 bg-subtle/15 px-5 py-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted/40">
          <MessagesSquare size={20} className="text-muted-foreground/60" aria-hidden />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Sessions</span>
        <p className="text-2xs leading-relaxed text-muted-foreground/50">
          Switch workspaces, manage sessions, track agents and workflow progress.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 rounded-lg border border-border-soft/30 bg-background/30 px-6 py-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare size={20} className="text-primary/60" aria-hidden />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Chat</span>
        <p className="text-2xs leading-relaxed text-muted-foreground/50">
          Talk to your agents, send instructions, and watch execution unfold in real time.
        </p>
      </div>

      <div className="flex w-[26%] flex-col items-center gap-3 rounded-lg border border-border-soft/30 bg-subtle/15 px-5 py-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted/40">
          <BookOpen size={20} className="text-muted-foreground/60" aria-hidden />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Context</span>
        <p className="text-2xs leading-relaxed text-muted-foreground/50">
          Inject context slots, review touched files, and check PR details at a glance.
        </p>
      </div>
    </div>
  );
}

function EmptyStateLogo() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 shadow-lg backdrop-blur-sm">
        <DogMascot size={56} className="text-foreground" />
      </div>
    </div>
  );
}

function KeyboardHints({ hasWorkspace }: { hasWorkspace: boolean }) {
  if (!hasWorkspace) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-2xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <span className="ml-1">command palette</span>
      </span>
      <span className="text-muted-foreground/30">·</span>
      <span className="inline-flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>,</Kbd>
        <span className="ml-1">settings</span>
      </span>
      <span className="text-muted-foreground/30">·</span>
      <span className="inline-flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>/</Kbd>
        <span className="ml-1">shortcuts</span>
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded border border-border-soft bg-subtle/60 px-1 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
