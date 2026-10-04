import { useEffect, useState } from 'react';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { ACTIVITY_RESOLVES_SESSION, seedActivityResolvesScene } from './activityResolvesSeed';
import { ShellFrame } from './shellChrome';

export type ActivityResolvesStep = 'none' | 'burst' | 'log';

const targetOf = ({
  step,
}: {
  readonly step: Exclude<ActivityResolvesStep, 'none'>;
}): HTMLElement | null => {
  if (step === 'log') {
    const tabs = Array.from(window.document.querySelectorAll<HTMLElement>('[role="tab"]'));
    return tabs.find((tab) => tab.textContent === 'Log') ?? null;
  }
  const toggles = Array.from(
    window.document.querySelectorAll<HTMLElement>('button[aria-expanded="false"]'),
  );
  return (
    toggles.find((toggle) => /Resolve #318 · \d+ agents/.test(toggle.textContent ?? '')) ?? null
  );
};

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
      const target = targetOf({ step });
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
