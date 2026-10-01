import { cn } from '@goodboy/ui';
import { StepTreeGutter } from './StepTreeGutter';
import type { StepLaneSpan } from './StepTreeLane';

type Props = {
  readonly index: number;
  readonly isActive: boolean;
  readonly identityIndex: number;
};

const spanOf = ({ index }: { readonly index: number }): StepLaneSpan =>
  index === 0 ? 'none' : 'through';

export const StepDropZone = ({ index, isActive, identityIndex }: Props) => (
  <li aria-hidden data-dropindex={index} className="flex h-3 min-w-0 gap-1.5">
    <StepTreeGutter span={spanOf({ index })} identityIndex={identityIndex} />
    <span className="flex min-w-0 flex-1 items-center pl-2">
      <span
        className={cn(
          'h-0.5 w-full rounded-full motion-safe:transition-colors',
          isActive ? 'bg-primary' : 'bg-transparent',
        )}
      />
    </span>
  </li>
);
