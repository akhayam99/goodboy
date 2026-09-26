import { useEffect, useRef, useState } from 'react';
import { Unlink } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import type {
  RecordFrame,
  RecordVerb,
} from '../../../../shared/components/StudioDetail/RecordActions/types';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { useAppStore } from '../../../../store';
import { LaunchSessionPopover } from '../../components/LaunchSessionPopover';
import { launchSpecFor } from '../../launchSpecFor';
import type { InboxRecord } from '../../types';

type Params = {
  readonly record: InboxRecord;
  readonly workspaceId: WorkspaceId;
  readonly launchRequest: number;
  readonly onLaunched: () => void;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
};

export const useRecordFrame = ({
  record,
  workspaceId,
  launchRequest,
  onLaunched,
  onRefresh,
  onClose,
}: Params): RecordFrame => {
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const openSession = useOpenSession();
  const [isUnlinking, setIsUnlinking] = useState(false);
  const spec = launchSpecFor({ record });
  const linkedSessionId = spec?.linkedSessionId ?? null;
  const handled = useRef(launchRequest);

  useEffect(() => {
    if (launchRequest === handled.current) {
      return;
    }
    handled.current = launchRequest;
    if (linkedSessionId == null) {
      return;
    }
    openSession({ sessionId: linkedSessionId, onOpened: onLaunched });
  }, [launchRequest, linkedSessionId, openSession, onLaunched]);

  const primary =
    spec == null ? null : linkedSessionId != null ? (
      <OpenSessionButton sessionId={linkedSessionId} onOpened={onLaunched} />
    ) : (
      <LaunchSessionPopover
        workspaceId={workspaceId}
        spec={spec}
        openRequest={launchRequest}
        onLaunched={onLaunched}
      />
    );

  const sentryIssueId = record.payload.provider === 'sentry' ? record.payload.issue.id : null;
  const unlink: RecordVerb | null =
    sentryIssueId != null && linkedSessionId != null
      ? {
          key: 'unlink-session',
          label: 'Unlink session',
          icon: Unlink,
          isBusy: isUnlinking,
          blockedReason: null,
          confirm: null,
          onRun: async () => {
            setIsUnlinking(true);
            try {
              await unlinkSessionExternalTask(linkedSessionId, 'sentry', sentryIssueId);
            } catch (error: unknown) {
              void reportError({ title: "Couldn't unlink the session", error });
            } finally {
              setIsUnlinking(false);
            }
          },
        }
      : null;

  return {
    primary,
    sessionVerbs: unlink == null ? [] : [unlink],
    onRefresh,
    onClose,
  };
};
