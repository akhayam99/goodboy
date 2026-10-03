import { cn } from '@goodboy/ui';

type Props = {
  readonly index: number;
  readonly isActive: boolean;
  readonly isShown: boolean;
};

export const PolicyDropZone = ({ index, isActive, isShown }: Props) => (
  <li
    aria-hidden
    data-dropindex={index}
    className={cn('flex items-center', isShown ? 'h-2' : 'h-0')}
  >
    <span
      className={cn(
        'h-0.5 w-full rounded-full motion-safe:transition-colors',
        isActive ? 'bg-primary' : 'bg-transparent',
      )}
    />
  </li>
);
