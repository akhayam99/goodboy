import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { projectAskOf } from './projectAskOf';
import { waitingTextOf } from './waitingTextOf';

type Params = {
  readonly view: AutoTreeView;
};

export const composerPlaceholderOf = ({ view }: Params): string | undefined => {
  if (projectAskOf({ view }) !== null) {
    return 'Pick a folder, or write to Auto';
  }
  if (waitingTextOf({ view }) !== null) {
    return 'Message Auto';
  }
  if (isAutoPlanAwaitingApproval({ view })) {
    const plan = view.artifacts.find((row) => row.artifact.kind === 'plan');
    return plan === undefined
      ? undefined
      : `Message Auto, or describe changes to plan v${plan.revision}`;
  }
  return undefined;
};
