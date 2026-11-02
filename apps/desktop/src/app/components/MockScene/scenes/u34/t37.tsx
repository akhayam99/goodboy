import { PullRequestActivitySkeleton } from '../../../../../features/branch/components/PullRequestTab/PullRequestActivitySkeleton';
import { PullRequestStatusStrip } from '../../../../../features/branch/components/PullRequestTab/PullRequestStatusStrip';
import type { StatusCell } from '../../../../../features/branch/components/PullRequestTab/statusCell';

const LOADING_CELLS: ReadonlyArray<StatusCell> = [
  {
    id: 'checks',
    label: 'Checks',
    word: 'Checking',
    detail: null,
    tone: 'neutral',
    opens: 'checks',
  },
  {
    id: 'review',
    label: 'Review',
    word: 'Not reviewed',
    detail: null,
    tone: 'neutral',
    opens: null,
  },
  { id: 'merge', label: 'Merge', word: 'Not ready', detail: null, tone: 'neutral', opens: null },
  { id: 'branch', label: 'Branch', word: 'Up to date', detail: null, tone: 'success', opens: null },
];

export const U34_T37_SCENES = {
  'u34-t37-pr-page-loading': () => (
    <div className="flex h-screen w-full flex-col gap-6 bg-background p-6">
      <PullRequestStatusStrip cells={LOADING_CELLS} onOpen={() => undefined} />
      <div className="max-w-prose">
        <PullRequestActivitySkeleton label="Reading the activity" />
      </div>
    </div>
  ),
};
