import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { planAwaitsYou } from './planAwaitsYou';

type Params = {
  readonly view: AutoTreeView;
};

export const isAutoPlanAwaitingApproval = ({ view }: Params): boolean =>
  view.artifacts.some((row) => planAwaitsYou({ row, level: view.level }));
