import { useEffect, useState } from 'react';
import { WorkflowsPane } from '../../../../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { PageSheet } from '../PageSheet';
import { C06_SESSION, seedC06Agents } from './c06ConversationSeed';

type Props = {
  readonly isEmpty: boolean;
};

export const C06AgentsScene = ({ isEmpty }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedC06Agents({ isEmpty });
    setIsReady(true);
  }, [isEmpty]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen bg-background text-foreground">
      <PageSheet>
        <WorkflowsPane session={C06_SESSION} />
      </PageSheet>
    </main>
  );
};
