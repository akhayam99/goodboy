import { useCallback, useEffect, useRef, useState } from 'react';
import { Band, Button, formatError, Notice, PaneShell } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import {
  bridgeRevoke,
  bridgeStart,
  bridgeStatus,
  bridgeStop,
  type BridgeStatus,
  type QrInfo,
} from '../../bridge';
import { PairedDevices } from '../CompanionStudio/PairedDevices';
import { PairingCode } from '../CompanionStudio/PairingCode';

const STATUS_POLL_MS = 3_000;

const PAIRING_STEPS = ['Open Goodboy on your iPhone.', 'Point the camera at this code.'];

type StopFailure = {
  readonly title: string;
  readonly error: unknown;
};

type Props = {
  readonly animationClassName: string;
  readonly onStopFailed: (failure: StopFailure) => void;
};

type MetaParams = {
  readonly status: BridgeStatus | null;
  readonly isShowingCode: boolean;
};

const metaOf = ({ status, isShowingCode }: MetaParams): string | undefined => {
  if (status === null) {
    return undefined;
  }
  if (isShowingCode) {
    return 'Pairing';
  }
  return `${status.enrolledCount} paired`;
};

export const IphonePage = ({ animationClassName, onStopFailed }: Props) => {
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(0);
  const enrolledRef = useRef(0);
  const isMountedRef = useRef(true);
  const pairedAtStartRef = useRef(0);
  const onStopFailedRef = useRef(onStopFailed);
  onStopFailedRef.current = onStopFailed;

  const enrolled = status?.enrolledCount ?? 0;
  enrolledRef.current = enrolled;
  const isPaired = enrolled > 0;
  const isShowingCode = !isPaired || isPairing || error !== null;
  const total = totalRef.current > 0 ? totalRef.current : 1;

  const refreshStatus = useCallback(async () => {
    try {
      const next = await bridgeStatus();
      if (isMountedRef.current) {
        setStatus(next);
      }
    } catch {
      if (isMountedRef.current) {
        setStatus(null);
      }
    }
  }, []);

  const mint = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await bridgeStart();
      if (!isMountedRef.current) {
        return;
      }
      totalRef.current = next.expiresInSecs;
      setRemaining(next.expiresInSecs);
      setInfo(next);
      await refreshStatus();
    } catch (failure) {
      if (isMountedRef.current) {
        setError(formatError(failure));
        setInfo(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [refreshStatus]);

  const revoke = useCallback(async () => {
    setIsRevoking(true);
    setError(null);
    try {
      await bridgeRevoke();
      setIsPairing(false);
      await mint();
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsRevoking(false);
    }
  }, [mint]);

  const pair = () => {
    setIsPairing(true);
    void mint();
  };

  const cancel = () => {
    setIsPairing(false);
    setError(null);
  };

  useEffect(() => {
    isMountedRef.current = true;
    void mint();
    return () => {
      isMountedRef.current = false;
      if (enrolledRef.current === 0) {
        void bridgeStop().catch((error: unknown) =>
          onStopFailedRef.current({ title: "Couldn't stop listening for iPhones", error }),
        );
      }
    };
  }, [mint]);

  useEffect(() => {
    if (info === null) {
      return;
    }
    const id = setInterval(() => setRemaining((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(id);
  }, [info]);

  useEffect(() => {
    if (isShowingCode && info !== null && remaining === 0 && !isLoading) {
      void mint();
    }
  }, [isShowingCode, remaining, info, isLoading, mint]);

  useEffect(() => {
    if (!isShowingCode) {
      return;
    }
    pairedAtStartRef.current = enrolledRef.current;
    const id = setInterval(() => void refreshStatus(), STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [isShowingCode, refreshStatus]);

  useEffect(() => {
    if (isPairing && enrolled > pairedAtStartRef.current) {
      setIsPairing(false);
    }
  }, [enrolled, isPairing]);

  const pairButton = (
    <Button variant="secondary" size="sm" onClick={pair}>
      {NAMES.pairIphone}
    </Button>
  );
  const cancelButton = isPaired ? (
    <Button variant="ghost" size="sm" onClick={cancel}>
      Cancel
    </Button>
  ) : undefined;

  return (
    <PaneShell
      page="settings"
      animationClassName={animationClassName}
      title={NAMES.iphone}
      meta={metaOf({ status, isShowingCode })}
      actions={isShowingCode ? cancelButton : pairButton}
    >
      {isShowingCode ? (
        <>
          <Band
            inset="content"
            label={NAMES.pairIphone}
            ariaLabel={NAMES.pairIphone}
            headingLevel={2}
          >
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex flex-col items-center gap-3">
                <PairingCode
                  info={info}
                  loading={isLoading}
                  error={error}
                  remaining={remaining}
                  total={total}
                  onMint={() => void mint()}
                />
              </div>
              <ol className="flex list-inside list-decimal flex-col gap-2 text-ui text-muted-foreground">
                {PAIRING_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </Band>
          <Notice
            tone="info"
            placement="inline"
            title="Goodboy for iPhone is in private testing"
            body="It cannot be downloaded yet. Pairing works with a build you already have."
          />
        </>
      ) : (
        <Band inset="content" label="Paired iPhones" ariaLabel="Paired iPhones" headingLevel={2}>
          <PairedDevices enrolled={enrolled} revoking={isRevoking} onRevoke={revoke} />
        </Band>
      )}
    </PaneShell>
  );
};
