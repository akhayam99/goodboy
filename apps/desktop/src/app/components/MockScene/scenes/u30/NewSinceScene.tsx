import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { CentralColumnPane } from '../u26/CentralColumnPane';
import { seedNewSince } from './newSinceSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const NewSinceScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedNewSince();
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div data-shot style={{ width: 1180, height: 900 }} className="[&>div]:h-full [&>div]:w-full">
        <CentralColumnPane />
      </div>
    </AutoReleaseContext.Provider>
  );
};
