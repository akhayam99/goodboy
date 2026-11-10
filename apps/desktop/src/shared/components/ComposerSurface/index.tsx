import type { ReactNode, Ref } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import { PromptDropOverlay } from '../PromptField/PromptDropOverlay';

type Drop = {
  readonly isDragging: boolean;
};

type Props = {
  readonly surfaceRef?: Ref<HTMLDivElement>;
  readonly drop?: Drop;
  readonly isDisabled?: boolean;
  readonly isJoinedAbove?: boolean;
  readonly kind?: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export const ComposerSurface = ({
  surfaceRef,
  drop,
  isDisabled = false,
  isJoinedAbove = false,
  kind,
  className,
  children,
}: Props) => (
  <div
    ref={surfaceRef}
    data-composer-surface=""
    data-drop-composer={drop === undefined ? undefined : true}
    data-prompt-field={kind}
    className={cn(
      '@container/prompt relative flex min-w-0 flex-col rounded-lg border transition-all',
      isJoinedAbove && 'rounded-t-none',
      drop?.isDragging === true
        ? cn(tintClasses('primary').bgSoft, 'border-primary')
        : cn(
            'border-border-soft bg-subtle hover:border-border',
            'focus-within:border-border-strong focus-within:shadow-xl',
          ),
      isDisabled && 'opacity-60',
      className,
    )}
  >
    {drop === undefined ? null : <PromptDropOverlay isDragging={drop.isDragging} />}
    {children}
  </div>
);
