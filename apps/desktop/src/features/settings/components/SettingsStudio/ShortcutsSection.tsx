import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { KbdPill, SectionHeader } from '@goodboy/ui';

type Props = {
  readonly initiallyExpanded: boolean;
};

const SHORTCUTS: ReadonlyArray<{ readonly combo: readonly string[]; readonly label: string }> = [
  { combo: ['⌘', 'K'], label: 'command palette' },
  { combo: ['⌘', 'O'], label: 'open workspace switcher' },
  { combo: ['⌘', 'N'], label: 'new session' },
  { combo: ['⌘', 'B'], label: 'toggle sessions sidebar' },
  { combo: ['⌘', '1', '..', '9'], label: 'jump to workspace 1 to 9' },
  { combo: ['⌘', '['], label: 'back (lens history)' },
  { combo: ['⌘', ']'], label: 'forward (lens history)' },
  { combo: ['⌘', '⇧', '['], label: 'previous session' },
  { combo: ['⌘', '⇧', ']'], label: 'next session' },
  { combo: ['⌘', '⇧', 'K'], label: 'open model picker' },
  { combo: ['⌘', '⇧', 'P'], label: 'open permission picker' },
  { combo: ['⌘', 'J'], label: 'toggle terminal' },
  { combo: ['⌘', 'T'], label: 'new terminal tab' },
  { combo: ['⌘', 'W'], label: 'close terminal tab' },
  { combo: ['⌘', '⇧', 'G'], label: 'jump to goal' },
  { combo: ['⌘', '⇧', 'W'], label: 'jump to workflows' },
  { combo: ['⌘', '⇧', 'B'], label: 'jump to agents' },
  { combo: ['⌘', '⇧', 'R'], label: 'jump to resolve' },
  { combo: ['⌘', '⇧', 'D'], label: 'jump to diff' },
  { combo: ['⌘', '⇧', 'L'], label: 'jump to plans' },
  { combo: ['⌘', '⇧', 'S'], label: 'jump to scripts' },
  { combo: ['⌘', '⇧', 'Q'], label: 'jump to questions' },
  { combo: ['⌘', '⇧', 'O'], label: 'jump to overview' },
  { combo: ['⌘', '⇧', 'H'], label: 'jump to GitHub or GitLab' },
  { combo: ['⌘', '⇧', 'E'], label: 'jump to decisions' },
  { combo: ['⌘', '⇧', 'U'], label: 'jump to session summary' },
  { combo: ['⌘', '⇧', '⎋'], label: 'back to board' },
  { combo: ['⌘', '↵'], label: 'send message (queue if running)' },
  { combo: ['⌘', '⇧', 'A'], label: 'archive current session' },
  { combo: ['⌘', '.'], label: 'delete current session' },
  { combo: ['⌘', ','], label: 'open settings' },
  { combo: ['⌘', '/'], label: 'keyboard shortcuts' },
  { combo: ['Esc'], label: 'close dialog or cancel' },
];

export const ShortcutsSection = ({ initiallyExpanded }: Props) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  useEffect(() => {
    if (initiallyExpanded) {
      setIsExpanded(true);
    }
  }, [initiallyExpanded]);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        label="Shortcuts"
        action={
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls="keyboard-shortcuts-list"
            aria-label={isExpanded ? 'Collapse keyboard shortcuts' : 'Expand keyboard shortcuts'}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className="rounded-full bg-muted px-2 py-0.5">{SHORTCUTS.length} shortcuts</span>
            {isExpanded ? (
              <ChevronDown size={13} aria-hidden />
            ) : (
              <ChevronRight size={13} aria-hidden />
            )}
          </button>
        }
      />
      {isExpanded ? (
        <ul id="keyboard-shortcuts-list" className="grid grid-cols-2 gap-x-10 gap-y-3">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">{shortcut.label}</span>
              <span className="flex items-center gap-0.5">
                {shortcut.combo.map((key) => (
                  <KbdPill key={key}>{key}</KbdPill>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
