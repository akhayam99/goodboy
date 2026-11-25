import { RUN_ROUTE_COPY } from './runRouteCopy';
import type { RunRouteResult } from './runRouteOf';

type Params = {
  readonly result: RunRouteResult;
};

export const routeLineOf = ({ result }: Params): string =>
  [`${RUN_ROUTE_COPY.runAs.startsAs} ${result.route.choice}`, result.route.why].join(' · ');
