import { useEffect, useState } from 'react';
import { FLOATING_SURFACE, cn } from '@goodboy/ui';
import { brandId, type SessionId } from '@goodboy/types';
import { SessionHoverCardBody } from '../../../../../features/workspace/components/SessionHoverCard/SessionHoverCardBody';
import { useAppStore } from '../../../../../store';
import { selectSessionById } from '../../../../../store/slices/sessions/selectSessionById';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';

const noop = (): undefined => undefined;

const sessionWithPullRequest = (): SessionId | null => {
  const entry = Object.entries(useAppStore.getState().sessionGithub).find(
    ([, github]) => (github?.pr ?? null) !== null,
  );
  return entry === undefined ? null : brandId<SessionId>({ value: entry[0] });
};

export const HoverFactsScene = () => {
  const [sessionId, setSessionId] = useState<SessionId | null>(null);
  const session = useAppStore((state) => selectSessionById(state, sessionId));

  useEffect(() => {
    seedBoardScene();
    const id = sessionWithPullRequest();
    if (id !== null) {
      useAppStore.setState({ sessionPins: { [WORKSPACE_ID]: [{ id, at: 1 }] } });
    }
    setSessionId(id);
  }, []);

  if (session === null) {
    return null;
  }

  return (
    <main className="flex h-screen items-start justify-center bg-background p-12 text-foreground">
      <div className={cn(FLOATING_SURFACE, 'w-80 p-3 text-meta')}>
        <SessionHoverCardBody
          session={session}
          isArchived={false}
          isFactsOnly
          onOpenAttention={noop}
          onOpenLegend={noop}
        />
      </div>
    </main>
  );
};
