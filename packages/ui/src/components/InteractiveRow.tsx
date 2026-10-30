import type { KeyboardEventHandler, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { ROW_HOVER } from '../rowInteractive';
import { SELECTED_ROW_CLASSES } from '../selectedRow';

export type InteractiveRowProps = {
  readonly label: string;
  readonly isSelected: boolean;
  readonly onOpen: () => void;
  readonly children: ReactNode;
  readonly dataAttributes?: Readonly<Record<`data-${string}`, string>>;
  readonly frameClassName?: string;
  readonly radius?: 'md' | 'lg';
  readonly className?: string;
  readonly menu?: {
    readonly onContextMenu: MouseEventHandler<HTMLElement>;
    readonly onKeyDown: KeyboardEventHandler<HTMLElement>;
  };
};

const RADIUS_CLASS = { md: 'rounded-md', lg: 'rounded-lg' } as const satisfies Record<
  'md' | 'lg',
  string
>;

type OpenFromTextParams = {
  readonly event: MouseEvent<HTMLElement>;
  readonly onOpen: () => void;
};

const openFromText = ({ event, onOpen }: OpenFromTextParams): void => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const control = target.closest('a, button');
  const isInsideControl = control !== null && event.currentTarget.contains(control);
  if (isInsideControl || target.closest('[data-truncated-text]') === null) {
    return;
  }
  onOpen();
};

export const InteractiveRow = ({
  label,
  isSelected,
  onOpen,
  children,
  dataAttributes,
  frameClassName,
  className,
  menu,
  radius = 'md',
}: InteractiveRowProps) => (
  <div
    data-selected={isSelected}
    onContextMenu={menu?.onContextMenu}
    onKeyDown={menu?.onKeyDown}
    className={cn(
      'relative text-muted-foreground hover:text-foreground',
      RADIUS_CLASS[radius],
      ROW_HOVER,
      SELECTED_ROW_CLASSES,
      frameClassName,
    )}
  >
    <button
      type="button"
      aria-label={label}
      aria-current={isSelected ? 'true' : undefined}
      onClick={onOpen}
      className={cn('absolute inset-0 cursor-pointer', RADIUS_CLASS[radius], FOCUS_RING)}
      {...dataAttributes}
    />
    <div
      onClick={(event) => openFromText({ event, onOpen })}
      className={cn(
        'pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_[data-truncated-text]]:pointer-events-auto',
        className,
      )}
    >
      {children}
    </div>
  </div>
);
