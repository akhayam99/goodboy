import { useMemo } from 'react';
import type { RunRoute } from '@goodboy/types';
import { RunRouteLine } from '../../../../../../features/session/components/RunRoute/RunRouteLine';
import type { RunRouteTarget } from '../../../../../../features/session/startRun/changeRunRoute';
import { SESSION, SESSION_ID } from '../../activityRunSeed';
import type { OneFlowCloseness, OneFlowShape } from './oneFlowCopy';
import { AUTO_ROOT_ID, PLAN_RUN_ID, PRESET_NAME } from './oneFlowSeed';

export type OneFlowRoute = Readonly<{
  shape: OneFlowShape;
  closeness: OneFlowCloseness | null;
  choice: string;
  why: string;
}>;

type Props = {
  readonly route: OneFlowRoute;
  readonly changeCount: number;
};

export const OneFlowRouteLine = ({ route, changeCount }: Props) => {
  const stored = useMemo(
    (): RunRoute => ({
      shape: route.shape,
      row: route.closeness === null ? 5 : 2,
      presetName: route.closeness === null ? null : PRESET_NAME,
      closeness: route.closeness,
      role: null,
      choice: route.choice,
      why: route.why,
    }),
    [route],
  );
  const target = useMemo(
    (): RunRouteTarget =>
      route.shape === 'plan'
        ? { kind: 'plan', sessionId: SESSION_ID, runId: PLAN_RUN_ID }
        : { kind: 'lead', sessionId: SESSION_ID, agentId: AUTO_ROOT_ID },
    [route.shape],
  );
  return (
    <div data-one-flow-change="" className="flex min-w-0">
      <RunRouteLine
        workspaceId={SESSION.workspaceId}
        target={target}
        route={stored}
        changeCount={changeCount}
      />
    </div>
  );
};
