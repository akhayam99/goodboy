import { MergeBox } from '../../../../../features/branch/components/PullRequestTab/MergeBox';
import { PullRequestActivitySkeleton } from '../../../../../features/branch/components/PullRequestTab/PullRequestActivitySkeleton';

export const U34_T37_SCENES = {
  'u34-t37-pr-page-loading': () => (
    <div className="flex h-screen w-full flex-col gap-6 bg-background p-6">
      <MergeBox box={null} onOpen={() => undefined} />
      <div className="max-w-prose">
        <PullRequestActivitySkeleton label="Reading the activity" />
      </div>
    </div>
  ),
};
