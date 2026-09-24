import { useEffect, useState } from 'react';
import { WorkflowBuilderView } from '../../../../../features/session/components/WorkflowBuilderView';
import { FLOW_SESSION, noop } from './fixtures';
import { seedWorkflowBuilder } from './seeds';

export const WorkflowBuilderScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowBuilder();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <WorkflowBuilderView session={FLOW_SESSION} onClose={noop} />
    </main>
  );
};
