import { useEffect } from 'react';
import { InboxDetail } from '../../../../../../features/inbox/components/InboxStudio/InboxDetail';
import type { InboxProvider, InboxRecord } from '../../../../../../features/inbox/types';
import { WORKSPACE_ID } from '../../BoardScene';

const noop = () => undefined;

const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

const EDIT_DELAY_MS = 50;

type Props = {
  readonly record: InboxRecord;
  readonly isFull?: boolean;
  readonly isEditing?: boolean;
};

export const IssueScenePane = ({ record, isFull = false, isEditing = false }: Props) => {
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-testid="description-body"]')?.click();
    }, EDIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isEditing]);

  return (
    <InboxDetail
      record={record}
      workspaceId={WORKSPACE_ID}
      rootPath="~/code/harborline/ledger-core"
      errors={NO_ERRORS}
      onRefresh={noop}
      onClose={noop}
      onDeselect={isFull ? null : noop}
      onOpenFull={isFull ? null : noop}
      star={{ isStarred: record.provider === 'linear', onToggle: noop }}
      launchFocusRequest={0}
    />
  );
};
