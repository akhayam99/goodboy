import { useState, type ReactNode } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly children: ReactNode;
};

export const BoardFactsFrame = ({ workspaceId, children }: Props) => {
  const error = useAppStore((s) => s.workspaceFactsError);
  const retryWorkspaceFacts = useAppStore((s) => s.retryWorkspaceFacts);
  const [isRetrying, setIsRetrying] = useState(false);
  if (error === null) {
    return children;
  }
  const retry = () => {
    setIsRetrying(true);
    void retryWorkspaceFacts({ workspaceId }).finally(() => setIsRetrying(false));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Notice
        tone="warning"
        placement="inline"
        role="status"
        title="Couldn't read what needs you"
        detail={error}
        actions={
          <Button size="sm" variant="secondary" onClick={retry} disabled={isRetrying}>
            Retry
          </Button>
        }
      />
      {children}
    </div>
  );
};
