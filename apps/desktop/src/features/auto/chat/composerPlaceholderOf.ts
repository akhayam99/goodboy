import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { waitingTextOf } from './waitingTextOf';

type Params = {
  readonly view: AutoTreeView;
};

export const composerPlaceholderOf = ({ view }: Params): string | undefined => {
  if (waitingTextOf({ view }) !== null) {
    return 'Queued: Auto sees it with the next results';
  }
  if (isAutoPlanAwaitingApproval({ view })) {
    const plan = view.artifacts.find((row) => row.artifact.kind === 'plan');
    return plan === undefined
      ? undefined
      : `Message Auto, or describe changes to plan v${plan.revision}`;
  }
  return undefined;
};
