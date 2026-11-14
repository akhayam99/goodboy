import type { FlowWord } from '../../../shared/lib/flowWordOf';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { projectAskOf } from './projectAskOf';
import { waitingTextOf } from './waitingTextOf';

type Params = {
  readonly view: AutoTreeView;
  readonly flow: FlowWord;
};

export const composerPlaceholderOf = ({ view, flow }: Params): string | undefined => {
  if (projectAskOf({ view }) !== null) {
    return `Pick a project, or write to ${flow}`;
  }
  if (waitingTextOf({ view }) !== null) {
    return `Message ${flow}`;
  }
  if (isAutoPlanAwaitingApproval({ view })) {
    const plan = view.artifacts.find((row) => row.artifact.kind === 'plan');
    return plan === undefined
      ? undefined
      : `Message ${flow}, or describe changes to plan v${plan.revision}`;
  }
  return undefined;
};
