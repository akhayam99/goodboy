import { useEffect, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { checksAnalyzeSeed } from '../u24/checksAnalyzeSeed';

type ExtraParams = {
  readonly sessionId: SessionId;
};

type Props = {
  readonly phase: 'failing' | 'running' | 'proposal';
  readonly extra?: (params: ExtraParams) => void;
};

export const BranchNextScene = ({ phase, extra }: Props) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const seeded = checksAnalyzeSeed({ phase });
    extra?.({ sessionId: seeded.sessionId });
    setSession(sessionById(useAppStore.getState().sessions, seeded.sessionId) ?? null);
  }, [phase, extra]);

  if (session === null) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorktreeSceneColumn>
        <BranchPage session={session} workingDir={null} />
      </WorktreeSceneColumn>
    </main>
  );
};
