import { useEffect, useState } from 'react';
import { PageColumn } from '@goodboy/ui';
import { WorkflowBuilderView } from '../../../../../features/workflows/components/WorkflowBuilderView';
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
    <main className="@container flex min-h-screen flex-col bg-background py-6 text-foreground">
      <PageColumn width="measure">
        <WorkflowBuilderView mode="preset" session={FLOW_SESSION} onClose={noop} />
      </PageColumn>
    </main>
  );
};
