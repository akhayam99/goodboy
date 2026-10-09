import { useEffect, useState } from 'react';
import { WorkspaceSwitcher } from '../../../../../../features/workspace/components/WorkspaceSwitcher';
import { useAppStore } from '../../../../../../store';
import { seedBoardScene } from '../../BoardScene';

const noop = () => undefined;

export const WorkspaceSwitcherSingleScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedBoardScene();
    useAppStore.setState({
      disconnectedWorkspaces: [],
      loadDisconnectedWorkspaces: async () => undefined,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen items-start justify-start bg-background p-6 text-foreground">
      <div className="w-80 overflow-hidden rounded-lg border border-border bg-floating shadow-lg">
        <WorkspaceSwitcher onClose={noop} />
      </div>
    </main>
  );
};
