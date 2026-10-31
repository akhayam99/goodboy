import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { AgentHeader } from '../../../../../features/session/components/AgentDetailPane/AgentHeader';
import { AgentSettingsLine } from '../../../../../features/session/components/AgentSettingsLine';
import { AgentRunRoute } from '../../../../../features/session/components/RunRoute/AgentRunRoute';
import { CHROME_AGENT_ID, CHROME_TITLE, seedChrome } from './chromeSeed';

const FRAME_WIDTH = 680;

const noop = () => undefined;

export const HeaderScene = () => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(seedChrome());
  }, []);
  if (session === null) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
      <div className="flex flex-col gap-2 p-6">
        <AgentHeader title={CHROME_TITLE} actions={null} />
        <AgentSettingsLine
          session={session}
          kind={<AgentRunRoute session={session} agentId={CHROME_AGENT_ID} />}
          auto={null}
          asksSlotRef={noop}
          modelsSlotRef={noop}
        />
      </div>
    </div>
  );
};
