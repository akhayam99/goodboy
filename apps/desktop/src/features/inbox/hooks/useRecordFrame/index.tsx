import { useEffect, useRef, useState } from 'react';
import { Unlink } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import type {
  RecordFrame,
  RecordVerb,
} from '../../../../shared/components/StudioDetail/RecordActions/types';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { NAMES } from '../../../../shared/names';
import { useAppStore } from '../../../../store';
import { requestNewSession } from '../../../session/requestNewSession';
import { pickIssue } from '../../../session/pickIssue';
import { LaunchSessionPopover } from '../../components/LaunchSessionPopover';
import { LinkedSessionButtons } from '../../components/LinkedSessionButtons';
import { LinkToSessionPicker } from '../../components/LinkToSessionPicker';
import { StartButton } from '../../components/StartButton';
import { launchSpecFor } from '../../launchSpecFor';
import { startFromRecord, startLabelOf } from '../../startFromRecord';
import { usePullRequestReviewStart } from '../../usePullRequestReviewStart';
import { useLaunchMount } from '../../useLaunchMount';
import { launchMountSourceOf } from '../../launchMountSourceOf';
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
  const start = startFromRecord({ record });
  const mount = useLaunchMount({ workspaceId, source: launchMountSourceOf({ record }) });
  const review = usePullRequestReviewStart({ workspaceId, mount });
  const linkedSessionId = spec?.linkedSessionId ?? null;
  const handled = useRef(launchRequest);

  const startKickoff = (): void => {
    if (start?.kind !== 'kickoff') {
      return;
    }
    pickIssue({ workspaceId, candidate: start.candidate });
    requestNewSession();
    onLaunched();
  };

  const startReview = async (): Promise<void> => {
    if (start?.kind !== 'review') {
      return;
    }
    if (await review.start({ pr: start.pr })) {
      onLaunched();
    }
  };

  useEffect(() => {
    if (launchRequest === handled.current) {
      return;
    }
    handled.current = launchRequest;
    if (start?.kind === 'open') {
      openSession({ sessionId: start.sessionId, onOpened: onLaunched });
      return;
    }
    if (start?.kind === 'kickoff') {
      startKickoff();
      return;
    }
    if (start?.kind === 'review') {
      void startReview();
    }
  }, [launchRequest]);

  const label = startLabelOf({ record });
  const startControl = (() => {
    if (start === null || label === null) {
      return null;
    }
    switch (start.kind) {
      case 'open':
        return (
          <LinkedSessionButtons
            sessionIds={record.linkedSessionIds ?? [start.sessionId]}
            onOpened={onLaunched}
          />
        );
      case 'kickoff':
        return <StartButton label={label} onClick={startKickoff} />;
      case 'review':
        return (
          <StartButton
            label={label}
            isBusy={review.isStarting}
            onClick={() => void startReview()}
          />
        );
      case 'panel':
        return (
          <LaunchSessionPopover
            workspaceId={workspaceId}
            spec={start.spec}
            label={label}
            openRequest={launchRequest}
            onLaunched={onLaunched}
            mount={mount}
          />
        );
    }
  })();

  const primary =
    spec == null || startControl === null ? null : (
      <>
        {startControl}
        {start?.kind === 'open' ? null : (
          <LinkToSessionPicker workspaceId={workspaceId} task={spec.externalTask} />
        )}
      </>
    );

  const sentryIssueId = record.payload.provider === 'sentry' ? record.payload.issue.id : null;
  const unlink: RecordVerb | null =
    sentryIssueId != null && linkedSessionId != null
      ? {
          key: 'unlink-session',
          label: `${NAMES.removeLink} to session`,
          icon: Unlink,
          isBusy: isUnlinking,
          blockedReason: null,
          confirm: null,
          onRun: async () => {
            setIsUnlinking(true);
            try {
              await unlinkSessionExternalTask(linkedSessionId, 'sentry', sentryIssueId);
            } catch (error: unknown) {
              void reportError({ title: "Couldn't remove the session link", error });
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
