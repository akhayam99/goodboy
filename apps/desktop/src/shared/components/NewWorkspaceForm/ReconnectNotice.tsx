import { Button } from '@goodboy/ui';
import { useNow } from '../../hooks/useNow';
import { pluralize } from '../../utils/pluralize';
import { formatAge } from '../../utils/time/formatAge';
import { FolderNotice } from './FolderNotice';
import type { DraftReconnect } from './useWorkspaceDraft';

type Props = {
  readonly offer: DraftReconnect;
  readonly isBusy: boolean;
  readonly onReconnect: () => void;
  readonly onDismiss: () => void;
};

export const ReconnectNotice = ({ offer, isBusy, onReconnect, onDismiss }: Props) => {
  const now = useNow(30_000);
  const { candidate } = offer;
  const lead =
    candidate.moved === null ? 'This folder was part of' : 'This looks like it moved from';
  return (
    <FolderNotice
      tone="info"
      title={`${lead} ${candidate.workspaceName}.`}
      body={`It was disconnected ${formatAge({ from: candidate.disconnectedAt, now })}, with ${pluralize(candidate.sessionCount, 'session')}.`}
      actions={
        <>
          <Button variant="secondary" size="xs" disabled={isBusy} onClick={onReconnect}>
            Reconnect {candidate.workspaceName}
          </Button>
          <Button variant="ghost" size="xs" disabled={isBusy} onClick={onDismiss}>
            Start fresh
          </Button>
        </>
      }
    />
  );
};
