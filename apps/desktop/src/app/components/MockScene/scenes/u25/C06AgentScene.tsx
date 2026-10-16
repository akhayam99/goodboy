import { useEffect, useState } from 'react';
import type { Agent } from '@goodboy/types';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { FixRunTranscriptDrawer } from '../../../FixRunTranscriptDrawer';
import { PageSheet } from '../PageSheet';
import { useSceneClicks } from '../audit/useSceneClicks';
import {
  C06_AGENT_ID,
  C06_SESSION,
  C06_SESSION_ID,
  seedC06,
  type C06State,
} from './c06ConversationSeed';

type Props = {
  readonly state: C06State;
  readonly isTranscriptOpen?: boolean;
  readonly isStepsOpen?: boolean;
  readonly clicks?: ReadonlyArray<string>;
};

const NO_CLICKS: ReadonlyArray<string> = [];

const EXPAND_DELAY_MS = 200;

export const C06AgentScene = ({
  state,
  isTranscriptOpen = false,
  isStepsOpen = false,
  clicks = NO_CLICKS,
}: Props) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  useSceneClicks({
    isReady: agent !== null,
    labels: clicks,
    selector: 'button',
    match: 'prefix',
    intervalMs: 400,
  });

  useEffect(() => {
    setAgent(seedC06({ state }));
  }, [state]);

  useEffect(() => {
    if (agent === null || !isStepsOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      const lines = document.querySelectorAll<HTMLButtonElement>('[data-turn-steps] button');
      lines[lines.length - 1]?.click();
    }, EXPAND_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [agent, isStepsOpen]);

  if (agent === null) {
    return null;
  }

  return (
    <main className="flex h-screen bg-background text-foreground">
      <PageSheet>
        <AgentDetailPane
          session={C06_SESSION}
          agent={agent}
          isChatActive
          onBack={() => undefined}
        />
      </PageSheet>
      {isTranscriptOpen ? (
        <aside aria-label="Transcript pane" className="flex w-[416px] shrink-0 flex-col bg-subtle">
          <FixRunTranscriptDrawer
            sessionId={C06_SESSION_ID}
            agentId={C06_AGENT_ID}
            onClose={() => undefined}
          />
        </aside>
      ) : null}
    </main>
  );
};
