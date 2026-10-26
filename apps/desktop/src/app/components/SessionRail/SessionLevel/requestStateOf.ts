import type { MountRequestView } from '../../../../store/slices/project-mounts/mountRowModel';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import type { PullRequestPresentationState } from '../../../../shared/utils/pullRequestPresentation';

type Params = {
  readonly request: MountRequestView | null;
};

export const requestStateOf = ({ request }: Params): PullRequestPresentationState =>
  request === null ? 'none' : pullRequestKindOf({ state: request.state, isDraft: request.isDraft });
