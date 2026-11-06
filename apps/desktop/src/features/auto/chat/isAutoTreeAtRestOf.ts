import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { projectAskOf } from './projectAskOf';

type Params = {
  readonly view: AutoTreeView;
};

const AT_REST: ReadonlySet<AutoTreeView['tree']['phase']> = new Set([
  'answering',
  'done',
  'finished',
]);

export const isAutoTreeAtRestOf = ({ view }: Params): boolean =>
  AT_REST.has(view.tree.phase) &&
  !isAutoPlanAwaitingApproval({ view }) &&
  projectAskOf({ view }) === null &&
  !view.delegations.some((delegation) => delegation.state === 'awaiting_confirm');
