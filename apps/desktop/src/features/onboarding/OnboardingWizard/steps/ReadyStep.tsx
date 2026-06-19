import { CheckCircle2 } from 'lucide-react';
import { KbdPill } from '@goodboy/ui';

export const ReadyStep = () => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
        <CheckCircle2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">You are all set</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Jump in and start your first session from the workspace, or explore from the sidebar. The
          checklist in the corner covers whatever is left.
        </p>
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5">
            <KbdPill>⌘</KbdPill>
            <KbdPill>K</KbdPill>
          </span>
          command palette
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5">
            <KbdPill>⌘</KbdPill>
            <KbdPill>N</KbdPill>
          </span>
          new session
        </span>
      </p>
    </div>
  );
};
