import { useCallback, useEffect, useRef, useState } from 'react';
import { FlaskConical, Smartphone } from 'lucide-react';
import { formatError, ScrollFade } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  bridgeRevoke,
  bridgeStart,
  bridgeStatus,
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
      await mint();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setRevoking(false);
    }
  }, [mint]);

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
    if (info !== null && remaining === 0 && !loading) {
      void mint();
    }
  }, [remaining, info, loading, mint]);

  const enrolled = status?.enrolledCount ?? 0;
  const total = totalRef.current > 0 ? totalRef.current : 1;
  const showsPairedDevices = error === null && info !== null && enrolled > 0;

  return (
    <StudioShell
      icon={Smartphone}
      title="Pair device"
      workspaceName="Connect Goodboy mobile"
      closeLabel="Close pairing"
      onClose={onClose}
    >
      {() => (
        <ScrollFade
          className="h-full min-h-0 w-full"
          viewportClassName="flex items-center justify-center"
        >
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-7 px-8 py-10">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Scan to pair</h2>
              <p className="max-w-[18rem] text-2xs text-muted-foreground">
                Open Goodboy on your iPhone and point the camera at this code.
              </p>
            </div>

            <div className="flex max-w-[20rem] items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-left">
              <FlaskConical
                size={ICON_SIZE.row}
                aria-hidden
                className="mt-0.5 shrink-0 text-warning"
              />
              <p className="text-2xs leading-relaxed text-warning">
                This feature is currently in testing. Contact the developer to get access before
                trying it out.
              </p>
            </div>

            <PairingCode
              info={info}
              loading={loading}
              error={error}
              remaining={remaining}
              total={total}
              onMint={() => void mint()}
            />

            {showsPairedDevices ? (
              <PairedDevices
                enrolled={enrolled}
                revoking={revoking}
                onRevoke={() => void revoke()}
              />
            ) : null}
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
