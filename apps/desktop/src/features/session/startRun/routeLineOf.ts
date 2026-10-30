import { RUN_ROUTE_COPY } from './runRouteCopy';
import type { RunRouteResult } from './runRouteOf';

type Params = {
  readonly result: RunRouteResult;
  readonly modelSummary: string;
  readonly isModelShown: boolean;
};

export const routeLineOf = ({ result, modelSummary, isModelShown }: Params): string =>
  [
    `${RUN_ROUTE_COPY.runAs.startsAs} ${result.route.choice}`,
    ...(isModelShown ? [modelSummary] : []),
    result.route.why,
  ].join(' · ');
