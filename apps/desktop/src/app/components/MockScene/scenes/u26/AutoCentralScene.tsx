import { useEffect, useMemo, useState } from 'react';
import { AutoAgentGroup } from '../../../../../features/auto/group/AutoAgentGroup';
import { autoGroupOf } from '../../../../../features/auto/autoGroupOf';
import { WorkTimeContext } from '../../../../../features/workTreeModel/workTimeSource';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import {
  CENTRAL_AUTO_NOW,
  CENTRAL_AUTO_SESSION,
  centralAutoSeedOf,
  type CentralAutoVariant,
} from './centralAutoSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly variant: CentralAutoVariant;
};

export const AutoCentralScene = ({ theme, variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const seed = useMemo(() => centralAutoSeedOf({ variant }), [variant]);
  const group = useMemo(
    () => autoGroupOf({ view: seed.view, agents: seed.agents, now: CENTRAL_AUTO_NOW }),
    [seed],
  );

  useEffect(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState({
      sessionPhaseRuns: { [CENTRAL_AUTO_SESSION]: seed.agents },
      autoTreeViews: { [CENTRAL_AUTO_SESSION]: [seed.view] },
      loadAutoTrees: async () => undefined,
      drawer: null,
    });
    setIsReady(true);
  }, [theme, seed]);

  if (!isReady || group === null) {
    return null;
  }
  return (
    <main className="flex min-h-screen items-start justify-center bg-background p-8 text-foreground">
      <div className="w-full max-w-[560px]">
        <WorkTimeContext.Provider value={seed.source}>
          <AutoAgentGroup group={group} isCompact={seed.isCompact} />
        </WorkTimeContext.Provider>
      </div>
    </main>
  );
};
