import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@kay-am/ui';
import type { SessionId } from '@kay-am/types';
import { CommandPalette } from './features/session/components/CommandPalette';
import { BootSplash } from './app/components/BootSplash';
import { ChatView } from './features/chat/components/ChatView';
import { ContextPanel } from './features/context/components/ContextPanel';
import { EndSessionDialog } from './features/session/components/EndSessionDialog';
import { SettingsDialog } from './features/settings/components/SettingsDialog';
import { ShortcutHelpDialog } from './features/settings/components/ShortcutHelpDialog';
import { ToastProvider } from './app/components/Toast';
import {
  WorkspacesSidebar,
  AddWorkspaceDialog,
} from './features/workspace/components/WorkspacesSidebar';
import { DogMascot } from './shared/components/DogMascot';
import { BookOpen, MessageSquare, MessagesSquare } from 'lucide-react';
import { useKeyboardShortcut } from './shared/hooks/use-keyboard-shortcut';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionById,
  useSessionSlots,
  useWorkspaces,
} from './store';
import { refreshPricingTable } from './features/providers/provider-pricing';
import { STORAGE_PREFIXES } from './shared/lib/storage-keys';

const CONTEXT_PANEL_KEY = (id: SessionId): string => `${STORAGE_PREFIXES.contextPanelOpen}${id}`;

// Cap on retained ChatView instances. Five covers nearly all real navigation
// patterns (recent N tabs) without unbounded memory growth from long sessions
// kept alive in the background.
const KEEP_ALIVE_CAP = 5;

function readPersistedContextOpen(id: SessionId, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(CONTEXT_PANEL_KEY(id));
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writePersistedContextOpen(id: SessionId, open: boolean): void {
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
  const [endOpen, setEndOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [contextHydratedFor, setContextHydratedFor] = useState<SessionId | null>(null);
  const [keepAliveIds, setKeepAliveIds] = useState<ReadonlyArray<SessionId>>([]);

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

  // Persist visited-session order across renders. Triggered by the same
  // currentSession change that drives the synchronous derivation above; this
  // just commits the new order to state so future switches reuse it.
  useEffect(() => {
    const id = currentSession?.id ?? null;
    if (!id) return;
    setKeepAliveIds((prev) => {
      if (prev[prev.length - 1] === id) return prev;
      const filtered = prev.filter((x) => x !== id);
      const next = [...filtered, id];
      return next.length > KEEP_ALIVE_CAP ? next.slice(next.length - KEEP_ALIVE_CAP) : next;
    });
  }, [currentSession?.id]);

  const onRequestEnd = useCallback(() => setEndOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openEndSession = useCallback(() => {
    if (currentSession) setEndOpen(true);
  }, [currentSession]);
  const openShortcutHelp = useCallback(() => setShortcutHelpOpen(true), []);

  useKeyboardShortcut('cmd+,', openSettings);
  useKeyboardShortcut('cmd+/', openShortcutHelp);
  useKeyboardShortcut('cmd+.', openEndSession);
  useKeyboardShortcut('cmd+k', () => setPaletteOpen(true));

  // Synchronous LRU: include the current session even before the persisting
  // effect runs, so the active view paints on the first frame after a switch.
  // Must stay above the early-return for hydrated to keep hook order stable.
  const renderedSessionIds = useMemo<ReadonlyArray<SessionId>>(() => {
    const cid = currentSession?.id ?? null;
    if (!cid) return keepAliveIds;
    if (keepAliveIds.includes(cid)) return keepAliveIds;
    const merged = [...keepAliveIds, cid];
    return merged.length > KEEP_ALIVE_CAP ? merged.slice(merged.length - KEEP_ALIVE_CAP) : merged;
  }, [keepAliveIds, currentSession?.id]);

  // Defer the heavy panel mount so sidebar selection + AppShell swap paint
  // urgently while React schedules the fresh ChatView/ContextPanel at low
  // priority. Active id is deferred too so the previous panel stays visible
  // (and `isActive`) during the lag — otherwise we'd flash a blank frame.
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

  const contextCollapsed = !contextOpen;
  const rightSidebarCollapsed = !currentSession || contextCollapsed;

  return (
    <ToastProvider>
      <AppShell
        leftWidthStorageKey="kay-am:left-sidebar-width"
        rightWidthStorageKey="kay-am:right-sidebar-width"
        leftSidebar={
          hasWorkspaces ? <WorkspacesSidebar onOpenSettings={openSettings} /> : undefined
        }
        main={
          error ? (
            <p className="p-6 text-sm text-danger">init error: {error}</p>
          ) : currentSession ? (
            <div className="relative h-full w-full">
              {deferredRenderedIds.map((id) => (
                <KeepAliveChatPanel
                  key={id}
                  sessionId={id}
                  isActive={id === deferredActiveId}
                  onRequestEnd={onRequestEnd}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              hasWorkspace={Boolean(currentWorkspace)}
              onAddWorkspace={() => setAddWorkspaceOpen(true)}
            />
          )
        }
        rightSidebar={
          currentSession ? (
            // Same keep-alive pattern as the chat panel: the LRU window of
            // recently-visited sessions stays mounted, only visibility flips
            // on switch. ContextPanel gates its own session-change effects
            // (loadDiffComments, refreshSessionPr*) on isActive so hidden
            // panels don't fire background work.
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
      <AddWorkspaceDialog open={addWorkspaceOpen} onClose={() => setAddWorkspaceOpen(false)} />
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

interface KeepAliveChatPanelProps {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly onRequestEnd: () => void;
}

function KeepAliveChatPanel({ sessionId, isActive, onRequestEnd }: KeepAliveChatPanelProps) {
  const session = useSessionById(sessionId);
  if (!session) return null;
  return (
    <div hidden={!isActive} className="absolute inset-0">
      <ChatView session={session} isActive={isActive} onRequestEnd={onRequestEnd} />
    </div>
  );
}

interface KeepAliveContextPanelProps {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
}

function KeepAliveContextPanel({
  sessionId,
  isActive,
  collapsed,
  onCollapse,
  onExpand,
}: KeepAliveContextPanelProps) {
  const session = useSessionById(sessionId);
  if (!session) return null;
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
            Spin up a new session from the sidebar, or jump back into an existing one. Each session
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
            Welcome to kAY.am
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Point at a git repo to create your first workspace. Every session spins up its own
            worktree and branch — your main checkout stays untouched.
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
      <div className="flex w-[30%] flex-col items-center gap-3 rounded-xl border border-border-soft/30 bg-subtle/15 px-5 py-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted/40">
          <MessagesSquare size={20} className="text-muted-foreground/60" aria-hidden />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Sessions</span>
        <p className="text-2xs leading-relaxed text-muted-foreground/50">
          Switch workspaces, manage sessions, track agents and workflow progress.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 rounded-xl border border-border-soft/30 bg-background/30 px-6 py-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare size={20} className="text-primary/60" aria-hidden />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Chat</span>
        <p className="text-2xs leading-relaxed text-muted-foreground/50">
          Talk to your agents, send instructions, and watch execution unfold in real time.
        </p>
      </div>

      <div className="flex w-[26%] flex-col items-center gap-3 rounded-xl border border-border-soft/30 bg-subtle/15 px-5 py-6">
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
      <div className="absolute -inset-6 animate-pulse rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-border-soft/40 bg-subtle/40 shadow-lg backdrop-blur-sm">
        <DogMascot size={56} className="text-foreground" />
      </div>
    </div>
  );
}

function KeyboardHints({ hasWorkspace }: { hasWorkspace: boolean }) {
  if (!hasWorkspace) return null;
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
