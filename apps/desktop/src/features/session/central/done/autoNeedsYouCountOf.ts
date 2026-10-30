import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { AutoChildState, AutoGroup } from '../../../auto/autoGroupOf';

type Params = {
  readonly view: AutoTreeView;
  readonly group: AutoGroup | null;
};

const NEEDS_YOU_STATES: ReadonlySet<AutoChildState> = new Set<AutoChildState>([
  'failed',
  'blocked',
  'timedOut',
  'neverStarted',
]);

export const autoNeedsYouCountOf = ({ view, group }: Params): number =>
  (view.rootAsk === null ? 0 : 1) +
  (group?.children ?? []).filter(
    (child) => child.isGone !== true && NEEDS_YOU_STATES.has(child.state),
  ).length;
