import { useEffect, useState } from 'react';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SESSION, seedArtifactScene } from './artifactSeed';

const openActivityFilter = (): boolean => {
  const trigger = window.document.querySelector<HTMLButtonElement>(
    'button[aria-label="Filter the activity feed"]',
  );
  if (trigger === null) {
    return false;
  }
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click();
  }
  return trigger.getAttribute('aria-expanded') === 'true';
};

type Props = {
  readonly isFilterOpen: boolean;
};

const ActivityScene = ({ isFilterOpen }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene();
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !isFilterOpen) {
      return;
    }
    const interval = window.setInterval(() => {
      if (openActivityFilter()) {
        window.clearInterval(interval);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [isFilterOpen, isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <SessionOverviewPane session={SESSION} onSelectLens={() => undefined} />
      </div>
    </main>
  );
};

export const ActivityTimelineScene = () => <ActivityScene isFilterOpen={false} />;

export const ActivityFilterScene = () => <ActivityScene isFilterOpen />;
