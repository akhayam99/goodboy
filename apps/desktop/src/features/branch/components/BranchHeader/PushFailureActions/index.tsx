import { useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PushFixStatusLine } from '../../../../../shared/components/PushFixStatusLine';
import { usePushFix } from '../../../../../shared/hooks/usePushFix';
import { NAMES } from '../../../../../shared/utils/names';
import { captureStartHint } from '../../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../../store/slices/startHints/startHintScopes';
import { OriginCheckAsk } from './OriginCheckAsk';
import { useOriginRecheck } from './useOriginRecheck';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly isForce: boolean;
  readonly confirmedOnlyOnline: ReadonlyArray<string> | null;
  readonly confirmedRemoteSha: string | null;
  readonly isOriginMoved?: boolean;
  readonly message: string;
  readonly onResolved: () => void;
};

type ErrorParams = {
  readonly message: string | null;
};

export const PushFailureActions = ({
  sessionId,
  mountId,
  isForce,
  confirmedOnlyOnline,
  confirmedRemoteSha,
  isOriginMoved = false,
  message,
  onResolved,
}: Props) => {
  const [isFixing, setIsFixing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fix = usePushFix({ sessionId, mountId, onSettled: onResolved });
  const recheck = useOriginRecheck({
    sessionId,
    mountId,
    onResolved,
    onError: ({ message: next }: ErrorParams) => setError(next),
  });
  const pushInput = {
    sessionId,
    mountId,
    isForce,
    confirmedOnlyOnline,
    confirmedRemoteSha,
    isOriginMoved,
  };
  const fixWithAgent = async () => {
    const state = useAppStore.getState();
    const capture = captureStartHint({
      state,
      sessionId,
      scope: START_HINT_SCOPES.pushFix({ mountId }),
    });
    setIsFixing(true);
    setError(null);
    try {
      await state.fixBranchPushWithAgent({
        ...pushInput,
        message,
        hint: capture.text,
        onAccepted: () => state.settleStartHint({ capture }),
      });
    } catch (caught) {
      setError(`Couldn't start the agent. ${formatError(caught)}`);
    } finally {
      setIsFixing(false);
    }
  };
  const openTerminal = async () => {
    setIsOpening(true);
    setError(null);
    try {
      await useAppStore.getState().prefillBranchPushTerminal(pushInput);
    } catch (caught) {
      setError(`Couldn't open the terminal. ${formatError(caught)}`);
    } finally {
      setIsOpening(false);
    }
  };
  const isWorking = fix.kind === 'working';
  return (
    <div className="flex max-w-sm flex-wrap items-center gap-2">
      {fix.kind !== 'none' && fix.kind !== 'pushed' && (
        <PushFixStatusLine sessionId={sessionId} state={fix} />
      )}
      {!isWorking && recheck.check !== null && (
        <OriginCheckAsk
          check={recheck.check}
          phase={recheck.phase}
          onForcePush={() => void recheck.forcePush()}
          onRebase={() => void recheck.rebase()}
        />
      )}
      {!isWorking && recheck.check === null && (
        <>
          {isOriginMoved && (
            <Button
              size="sm"
              variant="primary"
              isBusy={recheck.phase === 'checking'}
              onClick={() => void recheck.checkAgain()}
            >
              Check again
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            isBusy={isFixing}
            onClick={() => void fixWithAgent()}
          >
            {NAMES.fixPushWithAgent}
          </Button>
          <Button size="sm" variant="ghost" isBusy={isOpening} onClick={() => void openTerminal()}>
            Open terminal here
          </Button>
        </>
      )}
      {error !== null && <p className="w-full min-w-0 text-meta text-danger">{error}</p>}
    </div>
  );
};
