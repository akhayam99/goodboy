import { X } from 'lucide-react';
import { Button, FLOATING_SURFACE, IconButton, cn } from '@goodboy/ui';
import type { OffscreenHint } from './useDemoHints';

type Props = {
  readonly hint: OffscreenHint;
  readonly onReveal: () => void;
  readonly onHide: () => void;
};

export const DemoHintSlot = ({ hint, onReveal, onHide }: Props) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
    <div
      role="note"
      aria-label="Hint"
      data-testid="demo-hint-slot"
      className={cn(
        'pointer-events-auto flex max-w-md items-center gap-3 py-2 pl-3 pr-2',
        FLOATING_SURFACE,
      )}
    >
      <p className="min-w-0 text-row text-foreground">{hint.copy}</p>
      <Button size="xs" variant="primary" onClick={onReveal}>
        Show control
      </Button>
      <IconButton icon={X} label="Hide hint" shortcut="Esc" size="xs" onClick={onHide} />
    </div>
  </div>
);
