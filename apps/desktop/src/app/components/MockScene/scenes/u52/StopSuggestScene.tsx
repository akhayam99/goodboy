import { useEffect, useState } from 'react';
import type { Agent } from '@goodboy/types';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../../../features/auto/testing/autoViewFixtures';
import { LeadSteps } from '../../../../../features/session/components/LeadPage/LeadSteps';
import { useAppStore } from '../../../../../store';
import { PageSheet } from '../PageSheet';
import { SceneDock } from './SceneDock';
import { stopSuggestViewOf, type StopSuggestState } from './stopSuggestSeed';

type Props = {
  readonly state: StopSuggestState;
};

const ROOT: Agent = {
  id: FIXTURE_ROOT,
  sessionId: FIXTURE_SESSION,
  ordinal: 0,
  name: 'Lead',
  status: 'completed',
  kind: 'auto',
};

export const StopSuggestScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [view] = useState(() => stopSuggestViewOf({ state }));
  useEffect(() => {
    useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
    setIsReady(true);
  }, [view]);
  if (!isReady) {
    return null;
  }
  return (
    <PageSheet>
      <div className="flex min-w-0 flex-col gap-4 p-4">
        <LeadSteps sessionId={FIXTURE_SESSION} rootAgentId={FIXTURE_ROOT} />
        <SceneDock view={view} rootAgent={ROOT} />
      </div>
    </PageSheet>
  );
};
