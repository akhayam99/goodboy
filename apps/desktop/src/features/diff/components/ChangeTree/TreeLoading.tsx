import { Skeleton } from '@goodboy/ui';
import { TreeFrame } from './TreeFrame';

const SKELETON_WIDTHS = ['w-3/5', 'w-2/5', 'w-4/5', 'w-1/2', 'w-1/3', 'w-3/4', 'w-2/5', 'w-1/2'];

export const TreeLoading = () => (
  <TreeFrame heading="Loading files…">
    <div role="status" aria-label="Loading files" className="flex flex-col gap-3 pt-2">
      {SKELETON_WIDTHS.map((width, index) => (
        <Skeleton key={index} className={`h-3 rounded-sm ${width}`} />
      ))}
    </div>
  </TreeFrame>
);
