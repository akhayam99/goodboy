import { PaneShell, ScrollFade } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { HomeGrid } from '../grid/HomeGrid';
import { visibleWidgetsOf } from '../grid/visibleWidgetsOf';
import { StartFirstSession } from '../StartFirstSession';
import { useHomeFacts } from '../hooks/useHomeFacts';
import { NeedsYou } from '../widgets/NeedsYou';
import { ProviderLimits } from '../widgets/ProviderLimits';
import { RunningNow } from '../widgets/RunningNow';
import { SessionsToFinish } from '../widgets/SessionsToFinish';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const HomePage = ({ workspaceId }: Props) => {
  const facts = useHomeFacts({ workspaceId });
  const ids = visibleWidgetsOf({ facts });
  const isEmpty = !facts.isLoading && !facts.hasSessions;
  return (
    <PaneShell page="home" scroll="body" title={NAMES.home}>
      <ScrollFade viewportClassName="flex flex-col gap-3 pb-6">
        {isEmpty ? <StartFirstSession /> : null}
        <HomeGrid
          ids={ids}
          render={({ id, size }) => {
            switch (id) {
              case 'sessionsToFinish':
                return <SessionsToFinish facts={facts} size={size} />;
              case 'needsYou':
                return <NeedsYou facts={facts} size={size} />;
              case 'runningNow':
                return <RunningNow facts={facts} size={size} />;
              case 'providerLimits':
                return <ProviderLimits facts={facts} size={size} />;
              default: {
                const exhaustive: never = id;
                return exhaustive;
              }
            }
          }}
        />
      </ScrollFade>
    </PaneShell>
  );
};
