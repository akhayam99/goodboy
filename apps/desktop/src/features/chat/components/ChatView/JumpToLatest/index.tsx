import { ArrowDown } from 'lucide-react';
import { cn, IconButton } from '@goodboy/ui';

type Props = {
  readonly isVisible: boolean;
  readonly onJump: () => void;
};

export const JumpToLatest = ({ isVisible, onJump }: Props) => (
  <div
    data-jump-to-latest=""
    data-visible={isVisible}
    inert={!isVisible}
    aria-hidden={!isVisible}
    className={cn(
      'absolute bottom-3 left-1/2 z-10 -translate-x-1/2 motion-safe:transition-opacity motion-safe:duration-(--duration-quick) motion-safe:ease-(--ease-enter)',
      isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
    )}
  >
    <IconButton
      icon={ArrowDown}
      label="Jump to latest"
      size="md"
      variant="outline"
      onClick={onJump}
      className="rounded-full bg-background ring-1 ring-border-soft"
    />
  </div>
);
