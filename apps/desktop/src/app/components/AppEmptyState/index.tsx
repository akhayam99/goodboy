import { BookOpen, MessageSquare, MessagesSquare } from 'lucide-react';
import { DogMascot } from '../../../shared/components/DogMascot';

export function EmptyState({
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
