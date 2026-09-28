import { Check } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ChatHandoff } from '../../chatHandoff';

type Props = {
  readonly handoff: ChatHandoff;
  readonly onOpen: (handoff: ChatHandoff) => void;
};

export const ChatHandoffNote = ({ handoff, onOpen }: Props) => (
  <div
    role="status"
    className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-2.5 py-1.5 text-label text-muted-foreground"
  >
    <Check size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
    <span className="shrink-0">{handoff.label} ·</span>
    <span className="min-w-0 flex-1 truncate text-foreground">{handoff.title}</span>
    <button
      type="button"
      onClick={() => onOpen(handoff)}
      className="shrink-0 rounded-sm px-1.5 py-0.5 text-foreground motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      Open session
    </button>
  </div>
);
