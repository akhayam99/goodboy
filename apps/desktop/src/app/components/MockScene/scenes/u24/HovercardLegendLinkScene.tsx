import { useEffect, useState } from 'react';
import { FLOATING_SURFACE, cn } from '@goodboy/ui';
import { SessionHoverCardBody } from '../../../../../features/workspace/components/SessionHoverCard/SessionHoverCardBody';
import { SESSION, seedActivityRunScene } from '../activityRunSeed';

const noop = () => undefined;

export const HovercardLegendLinkScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="bg-background p-6 text-foreground" style={{ width: 360 }}>
      <div className={cn(FLOATING_SURFACE, 'w-80 p-3 text-label')}>
        <SessionHoverCardBody
          session={SESSION}
          isArchived={false}
          onOpenAttention={noop}
          onOpenLegend={noop}
        />
      </div>
    </main>
  );
};
