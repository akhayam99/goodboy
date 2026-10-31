import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { seedChrome } from './chromeSeed';
import { SidebarColumns } from './SidebarColumns';

const FRAME_WIDTH = 680;

export const SidebarScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedChrome());
  }, []);
  if (session === null) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
      <div className="p-6">
        <SidebarColumns session={session} />
      </div>
    </div>
  );
};
