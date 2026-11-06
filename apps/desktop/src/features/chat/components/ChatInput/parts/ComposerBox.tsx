import type { ReactNode, RefObject } from 'react';
import { cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly composerRef: RefObject<HTMLDivElement | null>;
  readonly isDragging: boolean;
  readonly hasTray: boolean;
  readonly children: ReactNode;
};

export const ComposerBox = ({ composerRef, isDragging, hasTray, children }: Props) => (
  <div
    ref={composerRef}
    data-drop-composer
    className={cn(
      'relative flex min-w-0 flex-col rounded-lg border transition-all',
      hasTray && 'rounded-t-none',
      isDragging
        ? cn(tintClasses('primary').bgSoft, 'border-primary')
        : cn(
            'border-border-soft bg-subtle hover:border-border',
            'focus-within:border-border-strong focus-within:shadow-xl',
          ),
    )}
  >
    {children}
  </div>
);
