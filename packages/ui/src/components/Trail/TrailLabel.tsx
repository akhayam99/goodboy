import type { CSSProperties } from 'react';
import { cn } from '../../cn';

type Props = {
  readonly label: string;
  readonly isCurrent: boolean;
  readonly isIconOnly: boolean;
  readonly delayStyle?: CSSProperties;
};

export const TrailLabel = ({ label, isCurrent, isIconOnly, delayStyle }: Props) => (
  <span
    data-trail-label={isIconOnly ? 'hidden' : 'shown'}
    style={delayStyle}
    className={cn(
      'grid min-w-0 overflow-hidden',
      'motion-safe:transition-[grid-template-columns] motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]',
      isIconOnly ? 'grid-cols-[0fr]' : 'grid-cols-[1fr]',
    )}
  >
    <span
      aria-current={isCurrent ? 'page' : undefined}
      aria-hidden={isIconOnly ? true : undefined}
      style={delayStyle}
      className={cn(
        'min-w-0 truncate pl-1.5',
        'motion-safe:transition-opacity motion-safe:duration-120 motion-safe:ease-out motion-reduce:transition-opacity motion-reduce:duration-100',
        isIconOnly ? 'opacity-0' : 'opacity-100',
      )}
    >
      {label}
    </span>
  </span>
);
