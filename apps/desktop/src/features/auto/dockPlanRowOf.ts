import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { planAwaitsYou } from './planAwaitsYou';

type Params = {
  readonly view: AutoTreeView;
};

export const dockPlanRowOf = ({ view }: Params): AutoArtifactLedgerRow | null => {
  const plans = view.artifacts.filter((row) => row.artifact.kind === 'plan');
  return plans.find((row) => planAwaitsYou({ row, level: view.level })) ?? plans[0] ?? null;
};
