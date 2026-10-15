import { Square } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly text: string;
  readonly isStopping: boolean;
  readonly onChangeApproach: () => void;
  readonly onStop: () => void;
};

export const AutoWaitingStrip = ({ text, isStopping, onChangeApproach, onStop }: Props) => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-w-0 items-center gap-3 text-label text-muted-foreground"
  >
    <span
      aria-hidden
      className="size-1.5 shrink-0 rounded-full bg-info motion-safe:animate-soft-pulse"
    />
    <span className="min-w-0 flex-1 truncate">{text}</span>
    <Button variant="ghost" size="xs" disabled={isStopping} onClick={onChangeApproach}>
      Change approach
    </Button>
    <Button variant="ghost" size="xs" disabled={isStopping} isBusy={isStopping} onClick={onStop}>
      <Square size={ICON_SIZE.control} aria-hidden />
      Stop
    </Button>
  </div>
);
