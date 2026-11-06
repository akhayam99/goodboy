import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly error: string;
};

export const BoardFactsNotice = ({ workspaceId, error }: Props) => {
  const retryWorkspaceFacts = useAppStore((s) => s.retryWorkspaceFacts);
  const [isRetrying, setIsRetrying] = useState(false);
  const retry = () => {
    setIsRetrying(true);
    void retryWorkspaceFacts({ workspaceId }).finally(() => setIsRetrying(false));
  };
  return (
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
  );
};
