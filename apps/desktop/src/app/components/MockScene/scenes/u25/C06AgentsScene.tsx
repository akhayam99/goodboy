import { useEffect, useState } from 'react';
import { AgentsPane } from '../../../../../features/session/components/SessionWorkspace/parts/AgentsPane';
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
        <AgentsPane session={C06_SESSION} meta={undefined} />
      </PageSheet>
    </main>
  );
};
