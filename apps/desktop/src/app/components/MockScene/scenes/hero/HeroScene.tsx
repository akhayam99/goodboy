import { useEffect, useState } from 'react';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { ShellFrame } from '../shellChrome';
import { HERO_SESSION_ID, seedHero } from './heroSeed';

const FACE_HOLD_MS = 300;

export const HeroScene = () => {
  const [isReady, setIsReady] = useState(false);
  const session = useAppStore((state) => sessionById(state.sessions, HERO_SESSION_ID) ?? null);
  useEffect(() => {
    seedHero();
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      useAppStore.setState((state) => ({
        sessionFace: { ...state.sessionFace, [HERO_SESSION_ID]: 'overview' },
      }));
    }, FACE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [isReady]);
  if (!isReady || session === null) {
    return null;
  }
  return (
    <ShellFrame
      session={session}
      hasOwnTrail
      main={
        <div className="relative h-full w-full">
          <SessionWorkspace session={session} />
        </div>
      }
    />
  );
};
