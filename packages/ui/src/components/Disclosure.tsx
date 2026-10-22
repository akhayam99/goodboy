import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { ICON_SIZE } from '../iconSize';
import { Reveal } from './Reveal';

export type DisclosureProps = {
  readonly label: ReactNode;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly className?: string;
  readonly triggerClassName?: string;
  readonly actions?: ReactNode;
};

export const Disclosure = ({
  label,
  isOpen,
  onToggle,
  children,
  testId,
  className,
  triggerClassName,
  actions,
}: DisclosureProps) => {
  const bodyId = useId();
  const trigger = (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={bodyId}
      onClick={onToggle}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-hover',
        FOCUS_RING,
        isOpen && 'bg-hover',
        triggerClassName,
      )}
    >
      <ChevronRight
        size={ICON_SIZE.control}
        aria-hidden
        data-testid="disclosure-chevron"
        className={cn(
          'shrink-0 text-faint-foreground motion-safe:transition-transform',
          isOpen && 'rotate-90',
        )}
      />
      {label}
    </button>
  );

  return (
    <div data-testid={testId} className={cn('flex min-w-0 flex-col', className)}>
      {actions === undefined ? (
        trigger
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">{trigger}</div>
          {actions}
        </div>
      )}
      <Reveal
        open={isOpen}
        id={bodyId}
        className="flex min-w-0 flex-col pl-[calc(8px+14px+8px)] pr-2"
      >
        {children}
      </Reveal>
    </div>
  );
};
