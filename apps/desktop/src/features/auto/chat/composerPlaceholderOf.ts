import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { dockPlanOf } from '../dockPlanOf';
import { projectAskOf } from './projectAskOf';
import { waitingTextOf } from './waitingTextOf';

type Params = {
  readonly view: AutoTreeView;
};

export const composerPlaceholderOf = ({ view }: Params): string | undefined => {
  if (projectAskOf({ view }) !== null) {
    return 'Pick a project, or write to Lead';
  }
  if (waitingTextOf({ view }) !== null) {
    return 'Message Lead';
  }
  const plan = dockPlanOf({ view });
  if (plan?.kind === 'waiting') {
    return `Message Lead, or describe changes to plan v${plan.version}`;
  }
  return plan === null ? undefined : 'Message Lead';
};
