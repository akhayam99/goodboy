import { useEffect, useState } from 'react';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { ShellFrame } from '../shellChrome';
import { HERO_SESSION_ID, seedHero } from './heroSeed';

export const HeroScene = () => {
  const [isReady, setIsReady] = useState(false);
  const session = useAppStore((state) => sessionById(state.sessions, HERO_SESSION_ID) ?? null);
  useEffect(() => {
    seedHero();
    setIsReady(true);
  }, []);
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
