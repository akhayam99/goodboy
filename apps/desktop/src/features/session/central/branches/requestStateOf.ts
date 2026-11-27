import type { MountId, ProjectId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import type { MountRequestView } from '../../../../store/slices/project-mounts/mountRowModel';
import { requestFactsOf } from './branchFactsOf';
import type { BranchState } from './branchStateTone';
import { branchEntriesOf } from './branchStoryOf';

type Params = {
  readonly request: MountRequestView;
};

const NO_MOUNT = brandId<MountId>({ value: 'request-state' });

const NO_PROJECT = brandId<ProjectId>({ value: 'request-state' });

export const requestStateOf = ({ request }: Params): BranchState | null => {
  const { live, finished } = branchEntriesOf({
    facts: [
      {
        mountId: NO_MOUNT,
        mountPath: null,
        projectId: NO_PROJECT,
        projectName: '',
        branch: '',
        baseBranch: 'main',
        request: requestFactsOf({ request, isStale: false }),
        behind: null,
        isStale: false,
        checkedAgo: null,
        liveCount: 0,
        liveTitle: null,
        isFinished: false,
        status: null,
        series: null,
      },
    ],
    detailByMountId: new Map(),
  });
  return [...live, ...finished][0]?.story.state ?? null;
};
