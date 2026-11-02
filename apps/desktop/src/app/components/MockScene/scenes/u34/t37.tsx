import { PullRequestActivitySkeleton } from '../../../../../features/branch/components/PullRequestTab/PullRequestActivitySkeleton';
import { PullRequestStatusStrip } from '../../../../../features/branch/components/PullRequestTab/PullRequestStatusStrip';
import type { StatusCell } from '../../../../../features/branch/components/PullRequestTab/statusCell';

type PendingParams = Pick<StatusCell, 'id' | 'label'>;

const pendingCell = ({ id, label }: PendingParams): StatusCell => ({
  id,
  label,
  word: '',
  detail: null,
  tone: 'neutral',
  opens: null,
  isPending: true,
});

const LOADING_CELLS: ReadonlyArray<StatusCell> = [
  pendingCell({ id: 'checks', label: 'Checks' }),
  pendingCell({ id: 'review', label: 'Review' }),
  pendingCell({ id: 'merge', label: 'Merge' }),
  pendingCell({ id: 'branch', label: 'Branch' }),
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
