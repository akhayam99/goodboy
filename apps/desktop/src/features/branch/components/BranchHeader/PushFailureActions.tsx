import { useEffect, useRef, useState } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { captureStartHint } from '../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly isForce: boolean;
  readonly confirmedOnlyOnline: ReadonlyArray<string> | null;
  readonly confirmedRemoteSha: string | null;
  readonly message: string;
  readonly onResolved: () => void;
};

export const PushFailureActions = ({
  sessionId,
  mountId,
  isForce,
  confirmedOnlyOnline,
  confirmedRemoteSha,
  message,
  onResolved,
}: Props) => {
  const [isFixing, setIsFixing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const reportError = useAppStore((state) => state.reportError);
  const settledCount = useAppStore((state) => state.settledBranchPushes[mountId] ?? 0);
  const initialSettledCount = useRef(settledCount);
  useEffect(() => {
    if (settledCount > initialSettledCount.current) {
      onResolved();
    }
  }, [settledCount, onResolved]);
  const fixWithAgent = async () => {
    const state = useAppStore.getState();
    const capture = captureStartHint({
      state,
      sessionId,
      scope: START_HINT_SCOPES.pushFix({ mountId }),
    });
    setIsFixing(true);
    try {
      await state.fixBranchPushWithAgent({
        sessionId,
        mountId,
        isForce,
        confirmedOnlyOnline,
        confirmedRemoteSha,
        message,
        hint: capture.text,
        onAccepted: () => state.settleStartHint({ capture }),
      });
    } catch (error) {
      await reportError({ title: "Couldn't start the agent.", error, sessionId });
    } finally {
      setIsFixing(false);
    }
  };
  const openTerminal = async () => {
    setIsOpening(true);
    try {
      await useAppStore.getState().prefillBranchPushTerminal({
        sessionId,
        mountId,
        isForce,
        confirmedOnlyOnline,
        confirmedRemoteSha,
      });
    } catch (error) {
      await reportError({ title: "Couldn't open the terminal.", error, sessionId });
    } finally {
      setIsOpening(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="secondary" isBusy={isFixing} onClick={() => void fixWithAgent()}>
        Let an agent fix the push
      </Button>
      <Button size="sm" variant="ghost" isBusy={isOpening} onClick={() => void openTerminal()}>
        Open terminal here
      </Button>
    </>
  );
};
