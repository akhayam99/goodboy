import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { useAppStore } from '../../../../../store';
import { CentralColumnPane } from '../u26/CentralColumnPane';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';

export const SmallDoneScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedCentralColumn({ kind: 'mid' });
    const questions = useAppStore.getState().sessionOpenQuestions[COLUMN_SESSION_ID] ?? [];
    seedCentralColumn({ kind: 'finished' });
    useAppStore.setState({ sessionOpenQuestions: { [COLUMN_SESSION_ID]: questions } });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext value>
      <div data-shot className="h-[900px] w-[680px] bg-background text-foreground">
        <CentralColumnPane />
      </div>
    </AutoReleaseContext>
  );
};
