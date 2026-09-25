import { Skeleton, WorkNode } from '@goodboy/ui';
import { StepTreeGutter } from './StepTreeGutter';
import type { StepLaneSpan } from './StepTreeLane';

type Props = {
  readonly identityIndex: number;
};

const SKELETON_ROWS = 3;

const spanOf = ({ index }: { readonly index: number }): StepLaneSpan => {
  if (index === 0) {
    return 'origin';
  }
  return index === SKELETON_ROWS - 1 ? 'tip' : 'through';
};

export const StepTreeSkeleton = ({ identityIndex }: Props) => (
  <ol role="status" aria-label="Drafting plan" className="flex flex-col-reverse">
    {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
      <li key={index} className="flex min-w-0 gap-1.5">
        <StepTreeGutter
          span={spanOf({ index })}
          identityIndex={identityIndex}
          node={
            <WorkNode
              state="queued"
              mark={{ kind: 'index', value: String(index + 1) }}
              label={`Step ${index + 1}, drafting`}
            />
          }
        />
        <span className="flex h-8 min-w-0 flex-1 items-center gap-2.5 pl-2">
          <Skeleton className="h-4 w-24 rounded-sm" />
          <Skeleton className="h-3 flex-1 rounded-sm" />
        </span>
      </li>
    ))}
  </ol>
);
