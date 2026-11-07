import {
  CHECK_STATE,
  NOTHING_CHANGED,
  READ_FAILED,
  type ErrorRecovery,
} from '../../../store/slices/notifications/errorRecovery';
import { useEffect, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { pluralize } from '../../../shared/utils/pluralize';
import {
  setupOfferKey,
  setupOfferOf,
  setupOfferValueOf,
  type SetupOffer,
} from '../newWorktreeSettings';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly projectName: string;
  readonly branch: string;
};

type SaveParams = {
  readonly next: SetupOffer;
  readonly title: string;
  readonly recovery: ErrorRecovery;
};

type LineParams = {
  readonly offer: SetupOffer;
};

const carriedLine = ({ offer }: LineParams): string => {
  if (offer.carried === 0 && offer.skipped === 0) {
    return '';
  }
  const copied =
    offer.carried === 0 ? 'Copied no file.' : `Copied ${pluralize(offer.carried, 'file')}.`;
  return offer.skipped === 0
    ? copied
    : `${copied} ${pluralize(offer.skipped, 'file')} left where they were.`;
};

type TextParams = {
  readonly text: string;
};

const tailLineOf = ({ text }: TextParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1) ?? '';

export const WorktreeSetupOffer = ({
  sessionId,
  mountId,
  worktreePath,
  projectName,
  branch,
}: Props) => {
  const key = setupOfferKey({ mountId });
  const scriptId = `setup:${mountId}`;
  const raw = useAppStore((state) => state.settings[key]);
  const record = useAppStore((state) => state.scriptRuns[sessionId]?.[scriptId]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const runDiscoveredScript = useAppStore((state) => state.runDiscoveredScript);
  const reportError = useAppStore((state) => state.reportError);
  const offer = setupOfferOf({ raw });
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    void loadSetting(key).catch((error: unknown) =>
      reportError({
        recovery: READ_FAILED,
        title: "Couldn't read the setup offer",
        error,
        sessionId,
      }),
    );
  }, [key, loadSetting, reportError, sessionId]);

  if (offer === null || offer.state === 'dismissed') {
    return null;
  }

  const save = ({ next, title: failureTitle, recovery }: SaveParams) =>
    saveSetting(key, setupOfferValueOf({ offer: next })).catch((error: unknown) =>
      reportError({ recovery, title: failureTitle, error, sessionId }),
    );
  const dismiss = () =>
    void save({
      next: { ...offer, state: 'dismissed' },
      title: "Couldn't save the setup offer",
      recovery: NOTHING_CHANGED,
    });
  const command = offer.command;
  const run = async () => {
    if (command === null) {
      return;
    }
    setIsRunning(true);
    try {
      const result = await runDiscoveredScript({
        sessionId,
        scriptId,
        name: 'Setup',
        command,
        cwd: worktreePath,
        mountId,
      });
      if (result.exitCode === 0) {
        await save({
          next: { ...offer, state: 'done' },
          title: "Setup ran, but its completion wasn't saved",
          recovery: CHECK_STATE,
        });
      }
    } finally {
      setIsRunning(false);
    }
  };
  const title = `Worktree ${projectName}/${branch} is ready.`;

  if (record?.status === 'pending' && command !== null) {
    return <Notice tone="info" placement="inline" role="status" title={`Running ${command}…`} />;
  }
  if (offer.state === 'done') {
    return null;
  }
  if (record?.status === 'error' && command !== null) {
    const reason = tailLineOf({ text: record.result?.stderr ?? record.output ?? '' });
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={`Setup failed: ${command}`}
        body={reason === '' ? undefined : reason}
        actions={
          <>
            <Button
              variant="secondary"
              size="xs"
              isBusy={isRunning}
              disabled={isRunning}
              onClick={() => void run()}
            >
              Retry
            </Button>
            <Button variant="ghost" size="xs" onClick={dismiss}>
              Not now
            </Button>
          </>
        }
      />
    );
  }
  const carried = carriedLine({ offer });
  const proposed = command === null ? '' : `Setup proposed: ${command}.`;
  return (
    <Notice
      tone="info"
      placement="inline"
      role="status"
      title={title}
      body={[carried, proposed].filter((part) => part !== '').join(' ')}
      actions={
        <>
          {command === null ? null : (
            <Button
              variant="primary"
              size="xs"
              isBusy={isRunning}
              disabled={isRunning}
              onClick={() => void run()}
            >
              Run
            </Button>
          )}
          <Button variant="ghost" size="xs" onClick={dismiss}>
            {command === null ? 'Dismiss' : 'Not now'}
          </Button>
        </>
      }
    />
  );
};
