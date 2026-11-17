import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { dockPlanOf } from './dockPlanOf';

type Params = {
  readonly view: AutoTreeView;
};

export const isAutoPlanAwaitingApproval = ({ view }: Params): boolean =>
  dockPlanOf({ view })?.kind === 'waiting';
