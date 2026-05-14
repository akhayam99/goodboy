import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@kay-am/ui';
import type { TaskId } from '@kay-am/types';
import { CommandPalette } from './components/CommandPalette';
import { BootSplash } from './components/BootSplash';
import { ChatView } from './components/chat/ChatView';
import { ContextPanel } from './components/ContextPanel';
import { EndSessionDialog } from './components/EndSessionDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutHelpDialog } from './components/ShortcutHelpDialog';
import { ToastProvider } from './components/Toast';
import { WorkspacesSidebar } from './components/WorkspacesSidebar';
import { useKeyboardShortcut } from './hooks/use-keyboard-shortcut';
import { useAppStore, useCurrentSession, useCurrentWorkspace, useSessionSlots } from './store';
import { refreshPricingTable } from './providerPricing';
import { STORAGE_PREFIXES } from './storage-keys';

const CONTEXT_PANEL_KEY = (id: TaskId): string => `${STORAGE_PREFIXES.contextPanelOpen}${id}`;

function readPersistedContextOpen(id: TaskId, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(CONTEXT_PANEL_KEY(id));
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writePersistedContextOpen(id: TaskId, open: boolean): void {
  try {
    localStorage.setItem(CONTEXT_PANEL_KEY(id), open ? '1' : '0');
  } catch {
    // localStorage unavailable — ignore
  }
}

export function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const bootPhase = useAppStore((s) => s.bootPhase);
  const error = useAppStore((s) => s.error);
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const slots = useSessionSlots(currentSession?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(
    undefined,
  );
  const [endOpen, setEndOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [contextHydratedFor, setContextHydratedFor] = useState<TaskId | null>(null);

  useEffect(() => {
    void hydrate();
    void refreshPricingTable();
  }, [hydrate]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      setSettingsInitialSection(detail?.section);
      setSettingsOpen(true);
    };
    window.addEventListener('kayam:open-settings', handler);
    return () => window.removeEventListener('kayam:open-settings', handler);
  }, []);

  // Prevent macOS from exiting native fullscreen on ESC. Calling
  // preventDefault at the capture phase marks the event as handled in
  // WKWebView before it reaches the native responder chain. Dialogs and
  // dropdowns still receive the keydown and close normally via their own
  // listeners.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
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
    if (contextHydratedFor === currentSession.id) return;
    const enabledSlots = slots.filter((s) => s.enabled && s.value.length > 0).length;
    const fallback = enabledSlots > 0;
    setContextOpen(readPersistedContextOpen(currentSession.id, fallback));
    setContextHydratedFor(currentSession.id);
  }, [currentSession, slots, contextHydratedFor]);

  const onToggleContext = () => {
    if (!currentSession) return;
    setContextOpen((open) => {
      const next = !open;
      writePersistedContextOpen(currentSession.id, next);
      return next;
    });
  };

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openEndSession = useCallback(() => {
    if (currentSession) setEndOpen(true);
  }, [currentSession]);
  const openShortcutHelp = useCallback(() => setShortcutHelpOpen(true), []);

  useKeyboardShortcut('cmd+,', openSettings);
  useKeyboardShortcut('cmd+/', openShortcutHelp);
  useKeyboardShortcut('cmd+.', openEndSession);
  useKeyboardShortcut('cmd+k', () => setPaletteOpen(true));

  if (!hydrated) {
    return <BootSplash phase={bootPhase} error={error} onRetry={() => void hydrate()} />;
  }

  const contextCollapsed = !contextOpen;
  const rightSidebarCollapsed = !currentSession || contextCollapsed;

  return (
    <ToastProvider>
      <AppShell
        leftSidebar={<WorkspacesSidebar onOpenSettings={() => setSettingsOpen(true)} />}
        main={
          error ? (
            <p className="p-6 text-sm text-danger">init error: {error}</p>
          ) : currentSession ? (
            <ChatView session={currentSession} onRequestEnd={() => setEndOpen(true)} />
          ) : (
            <EmptyState hasWorkspace={Boolean(currentWorkspace)} />
          )
        }
        rightSidebar={
          currentSession ? (
            <ContextPanel
              session={currentSession}
              collapsed={contextCollapsed}
              onCollapse={onToggleContext}
              onExpand={onToggleContext}
            />
          ) : null
        }
        rightSidebarCollapsed={rightSidebarCollapsed}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialSection(undefined);
        }}
        initialSection={settingsInitialSection}
      />
      <ShortcutHelpDialog open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => {
            setSettingsOpen(true);
            setPaletteOpen(false);
          }}
          onNewSession={() => setPaletteOpen(false)}
          onOpenShortcutHelp={() => {
            setShortcutHelpOpen(true);
            setPaletteOpen(false);
          }}
        />
      ) : null}
      {currentSession ? (
        <EndSessionDialog
          session={currentSession}
          open={endOpen}
          onClose={() => setEndOpen(false)}
        />
      ) : null}
    </ToastProvider>
  );
}

function EmptyState({ hasWorkspace }: { hasWorkspace: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border-soft bg-subtle p-8 text-center shadow-sm">
        <span className="text-sm font-semibold tracking-tight">
          {hasWorkspace ? 'pick up where you left off' : 'add a workspace to begin'}
        </span>
        <p className="text-xs text-muted-foreground">
          {hasWorkspace
            ? 'create a session from the sidebar, or open an existing one.'
            : 'workspaces are git repos. each session is its own worktree + branch.'}
        </p>
      </div>
    </div>
  );
}
