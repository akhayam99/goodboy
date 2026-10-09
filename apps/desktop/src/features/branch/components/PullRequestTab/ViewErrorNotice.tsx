import { REVIEW_SOURCE_LABEL, type PullRequestFailureKind } from '@goodboy/core';
import { Button, Notice } from '@goodboy/ui';
import type { PullRequestHost } from '@goodboy/types';
import { openToolSettings } from '../../../integrations/openToolSettings';

type Props = {
  readonly host: PullRequestHost;
  readonly kind: PullRequestFailureKind | null;
  readonly error: string;
  readonly onReload: () => void;
};

export const ViewErrorNotice = ({ host, kind, error, onReload }: Props) => {
  const retry = (
    <Button size="sm" variant="secondary" onClick={onReload}>
      Retry
    </Button>
  );
  if (host === 'gitlab' && kind === 'denied') {
    return (
      <Notice
        tone="warning"
        placement="inline"
        title="Goodboy can't read this merge request"
        body="The GitLab token can't reach it. Give it the `api` scope."
        detail={error}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openToolSettings({ tool: 'gitlab' })}
            >
              Open {REVIEW_SOURCE_LABEL[host]} settings
            </Button>
            {retry}
          </>
        }
      />
    );
  }
  if (host === 'github') {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title="Couldn't read the activity"
        body={error}
        actions={retry}
      />
    );
  }
  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title="Couldn't read the activity"
      detail={error}
      actions={retry}
    />
  );
};
