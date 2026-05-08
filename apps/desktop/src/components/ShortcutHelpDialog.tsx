import { Dialog, KbdPill } from '@kay-am/ui';

interface ShortcutEntry {
  readonly combo: readonly string[];
  readonly label: string;
}

const SHORTCUTS: ReadonlyArray<ShortcutEntry> = [
  { combo: ['⌘', ','], label: 'open settings' },
  { combo: ['⌘', '/'], label: 'keyboard shortcut help' },
  { combo: ['⌘', '.'], label: 'end current session' },
  { combo: ['Esc'], label: 'close dialog / cancel' },
  { combo: ['⌘', 'K'], label: 'command palette' },
];

interface ShortcutHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutHelpDialog({ open, onClose }: ShortcutHelpDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="keyboard shortcuts"
      description="global shortcuts active anywhere in kAY.am."
      size="sm"
    >
      <ul className="flex flex-col divide-y divide-border-soft">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between py-2 text-xs">
            <span className="text-foreground">{s.label}</span>
            <span className="flex items-center gap-0.5">
              {s.combo.map((k) => (
                <KbdPill key={k}>{k}</KbdPill>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
