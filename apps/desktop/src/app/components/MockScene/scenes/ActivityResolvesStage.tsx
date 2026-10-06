import { useEffect, useState } from 'react';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';
import { ShellFrame } from './shellChrome';

export type ActivityResolvesStep = 'none' | 'log';

const logTab = (): HTMLElement | null =>
  Array.from(window.document.querySelectorAll<HTMLElement>('[role="tab"]')).find(
    (tab) => tab.textContent === 'Log',
  ) ?? null;

export const ActivityResolvesStage = ({ step }: { readonly step: ActivityResolvesStep }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityResolvesScene();
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || step === 'none') {
      return;
    }
    const interval = window.setInterval(() => {
      const target = logTab();
      if (target === null) {
        return;
      }
      target.click();
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, step]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={ACTIVITY_RESOLVES_SESSION}
      sidebar="collapsed"
      main={
        <SessionOverviewPane session={ACTIVITY_RESOLVES_SESSION} onSelectLens={() => undefined} />
      }
    />
  );
};
