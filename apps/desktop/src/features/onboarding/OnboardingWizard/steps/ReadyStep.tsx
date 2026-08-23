import { CheckCircle2 } from 'lucide-react';
import { KbdPill } from '@goodboy/ui';
import { SHORTCUTS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { ShortcutId } from '../../../../shared/keyboard/registry';

const READY_HINTS: ReadonlyArray<ShortcutId> = ['palette.open', 'session.new'];

export const ReadyStep = () => {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
        <CheckCircle2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">You are all set</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Start your first session; code hosts and tools connect any time from their studios.
        </p>
      </div>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground/70">
        {READY_HINTS.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <KbdPill>{shortcutGlyphs(id)}</KbdPill>
            {SHORTCUTS[id].label.toLowerCase()}
          </span>
        ))}
      </p>
    </div>
  );
};
