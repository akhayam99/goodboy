import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Divider, formatError, Notice, ScrollFade } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import {
  bridgeRevoke,
  bridgeStart,
  bridgeStatus,
  bridgeStop,
  type BridgeStatus,
  type QrInfo,
} from '../../bridge';
import { PairedDevices } from './PairedDevices';
import { PairingCode } from './PairingCode';

type Props = {
  readonly onClose: () => void;
};

export const CompanionStudio = ({ onClose }: Props) => {
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [isPairingAnother, setIsPairingAnother] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await bridgeStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  const mint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await bridgeStart();
      totalRef.current = next.expiresInSecs;
      setRemaining(next.expiresInSecs);
      setInfo(next);
      await refreshStatus();
    } catch (e) {
      setError(formatError(e));
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const revoke = useCallback(async () => {
    setRevoking(true);
    setError(null);
    try {
      await bridgeRevoke();
      setIsPairingAnother(false);
      await mint();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setRevoking(false);
    }
  }, [mint]);

  const pairAnother = useCallback(() => {
    setIsPairingAnother(true);
    void mint();
  }, [mint]);

  const enrolled = status?.enrolledCount ?? 0;

  const close = useCallback(() => {
    if (enrolled === 0) {
      void bridgeStop().catch(() => undefined);
    }
    onClose();
  }, [enrolled, onClose]);
  const isPaired = enrolled > 0;
  const isLoadingStatus = loading && status === null;
  const showsCode = !isPaired || isPairingAnother || error !== null;
  const total = totalRef.current > 0 ? totalRef.current : 1;

  useEffect(() => {
    void mint();
  }, [mint]);

  useEffect(() => {
    if (info === null) {
      return;
    }
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [info]);

  useEffect(() => {
    if (showsCode && info !== null && remaining === 0 && !loading) {
      void mint();
    }
  }, [showsCode, remaining, info, loading, mint]);

  return (
    <StudioShell
      icon={Smartphone}
      title="Pair device"
      subtitle="Connect Goodboy mobile"
      closeLabel="Close pairing"
      onClose={close}
    >
      {() => (
        <ScrollFade
          className="h-full min-h-0 w-full"
          viewportClassName="flex items-center justify-center"
        >
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-7 px-8 py-10">
            {!isLoadingStatus && (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <h2 className="text-title text-foreground">
                  {showsCode ? 'Scan to pair' : 'Paired devices'}
                </h2>
                {showsCode && (
                  <p className="max-w-[18rem] text-secondary text-muted-foreground">
                    Open Goodboy on your iPhone and point the camera at this code.
                  </p>
                )}
              </div>
            )}

            <Notice
              tone="warning"
              placement="inline"
              className="max-w-[20rem] text-left"
              title="Goodboy for iPhone is in private testing"
              body="It cannot be downloaded yet. Pairing works with a build you already have."
            />

            {showsCode && (
              <PairingCode
                info={info}
                loading={loading}
                error={error}
                remaining={remaining}
                total={total}
                onMint={() => void mint()}
              />
            )}

            {isPaired && showsCode && <Divider />}

            {isPaired && (
              <PairedDevices
                enrolled={enrolled}
                revoking={revoking}
                onRevoke={revoke}
                {...(!showsCode && { onPairAnother: pairAnother })}
              />
            )}
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
