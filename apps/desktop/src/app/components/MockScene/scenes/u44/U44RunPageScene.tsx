import { useEffect } from 'react';
import { leadPermissionsOf } from '@goodboy/core/auto';
import { workLeadPushView } from '../../../../../features/auto/testing/workLeadPushView';
import { withHeldAsks } from '../../../../../features/auto/testing/withHeldAsks';
import { runRoutesKey } from '../../../../../features/session/startRun/runRoutesSetting';
import { useAppStore } from '../../../../../store';
import { RunPageScene } from '../surfaces/run-page/RunPageScene';
import { AUTO_ROOT_ID, AUTO_SESSION, type AutoSceneData } from '../u24/autoSceneSeed';
import { U44_PLAN_ROUTE } from './runsSeed';

type ExtendParams = {
  readonly scene: AutoSceneData;
};

const pushAskOf = ({ scene }: ExtendParams): AutoSceneData => ({
  ...scene,
  view: withHeldAsks({ view: scene.view, held: workLeadPushView() }),
  rootTurn: { kind: 'idle', lastActivityAt: AUTO_SESSION.updatedAt },
});

const readPushAsk = async () =>
  leadPermissionsOf({
    leadRows: { push: 'ask' },
    defaultRows: {},
    sessionLevel: 'plan',
    workspaceLevel: null,
    isPlanApprovalOff: false,
    isWorkFlowOn: true,
    spendLimitUsd: 10,
  });

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isAsking: boolean;
};

export const U44RunPageScene = ({ theme, isAsking }: Props) => {
  useEffect(() => {
    const state = useAppStore.getState();
    useAppStore.setState({
      settings: {
        ...state.settings,
        [runRoutesKey({ sessionId: AUTO_SESSION.id })]: JSON.stringify({
          [AUTO_ROOT_ID]: U44_PLAN_ROUTE,
        }),
      },
      ...(isAsking ? { readLeadPermissions: readPushAsk } : {}),
    });
  }, [isAsking]);

  return isAsking ? (
    <RunPageScene state="working" theme={theme} isLead extend={pushAskOf} />
  ) : (
    <RunPageScene state="working" theme={theme} isLead />
  );
};
