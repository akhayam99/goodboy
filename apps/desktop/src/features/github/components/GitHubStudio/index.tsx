import { useEffect, useState } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { GitPullRequest, X } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { InboxList } from './InboxList';
import { PrDetailPanel } from './PrDetailPanel';
import { useGithubInbox } from './useGithubInbox';

interface Props {
  readonly workspaceName: string;
  readonly initialSessionId: SessionId | null;
  readonly onClose: () => void;
}

export function GitHubStudio({ workspaceName, initialSessionId, onClose }: Props) {
  const groups = useGithubInbox();
  const [focused, setFocused] = useState<SessionId | null>(initialSessionId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (focused !== null) return;
    const first = groups[0]?.rows[0]?.session.id ?? null;
    if (first) setFocused(first);
  }, [focused, groups]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <GitPullRequest size={16} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">GitHub</h1>
            <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
              beta
            </span>
          </div>
          <span className="truncate text-2xs text-muted-foreground">{workspaceName}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border-soft px-3 py-1.5',
            'text-xs font-medium text-muted-foreground transition-colors',
            'hover:border-border hover:bg-muted/50 hover:text-foreground',
          )}
          aria-label="close github studio"
        >
          <X size={13} aria-hidden /> Done
        </button>
      </header>
      <Divider />

      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto">
          <InboxList groups={groups} focusedSessionId={focused} onSelect={setFocused} />
        </div>
        <Divider orientation="vertical" />
        <div className="min-h-0 flex-1">
          <PrDetailPanel sessionId={focused} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
