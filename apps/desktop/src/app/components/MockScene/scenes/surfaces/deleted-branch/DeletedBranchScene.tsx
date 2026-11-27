import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../../features/auto/autoReleaseContext';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { ScenePlacesRail } from '../../ScenePlacesRail';
import { CentralColumnPane } from '../../u26/CentralColumnPane';
import { seedDeletedAfterMerge } from '../archived-work/archivedWorkSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const WIDTH = 1180;
const HEIGHT = 900;

export const DeletedBranchScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedDeletedAfterMerge();
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div
        data-shot
        style={{ width: WIDTH, height: HEIGHT }}
        className="[&>div]:h-full [&>div]:w-full"
      >
        <AppShell leftRail={<ScenePlacesRail />} main={<CentralColumnPane />} drawer={null} />
      </div>
    </AutoReleaseContext.Provider>
  );
};
