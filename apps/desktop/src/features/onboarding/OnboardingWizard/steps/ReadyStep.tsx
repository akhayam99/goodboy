import { CheckCircle2 } from 'lucide-react';
import { KbdPill } from '@goodboy/ui';

const TIPS: ReadonlyArray<{ readonly combo: ReadonlyArray<string>; readonly label: string }> = [
  { combo: ['⌘', 'K'], label: 'command palette' },
  { combo: ['⌘', 'N'], label: 'new session' },
];

export function ReadyStep() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success">
        <CheckCircle2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">You are all set</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Create a session from the sidebar to get going. The checklist in the corner covers the
          rest.
        </p>
      </div>

      <ul className="flex w-full max-w-sm flex-col gap-2">
        {TIPS.map((tip) => (
          <li
            key={tip.label}
            className="flex items-center justify-between rounded-lg border border-border-soft/40 bg-subtle/20 px-3.5 py-2.5"
          >
            <span className="text-xs text-foreground">{tip.label}</span>
            <span className="flex items-center gap-0.5">
              {tip.combo.map((k) => (
                <KbdPill key={k}>{k}</KbdPill>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
