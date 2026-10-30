import type { RunRoute } from '@goodboy/types';
import type { AutoLimitKind } from '../../auto/autoLimitCopy';
import { runKindOfRoute } from './runKindOfRoute';

type Params = {
  readonly route: RunRoute;
};

export const limitKindOfRoute = ({ route }: Params): AutoLimitKind | null => {
  const { shape } = runKindOfRoute({ route });
  return shape === 'agent' ? null : shape;
};
