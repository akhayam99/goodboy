import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { seedPagesScene } from './pagesSeed';

const TRIGGER = 'nav[aria-label="Breadcrumb"] button[aria-haspopup="menu"]';

const useOpenPagesMenu = ({ isReady }: { readonly isReady: boolean }): void => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      const trigger = window.document.querySelector<HTMLButtonElement>(TRIGGER);
      if (trigger === null) {
        return;
      }
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        trigger.click();
      }
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady]);
};

type Props = {
  readonly isBusy: boolean;
};

export const PagesMenuScene = ({ isBusy }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedPagesScene({ isBusy }));
  }, [isBusy]);
  useOpenPagesMenu({ isReady: session !== null });
  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
