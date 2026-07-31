import { useCallback, useEffect, useRef, useState } from 'react';
import { FlaskConical, RefreshCw, Smartphone, Unplug } from 'lucide-react';
import { Divider, ScrollFade, Skeleton, cn } from '@goodboy/ui';
import { StudioShell } from '../../shared/components/StudioShell';
import { bridgeRevoke, bridgeStart, bridgeStatus, type BridgeStatus, type QrInfo } from './bridge';
import { clearMobileSharedSessions } from './mobileConfinement';

type Props = {
  readonly onClose: () => void;
};

function barColorClass(remaining: number, total: number): string {
  const ratio = total > 0 ? remaining / total : 0;
  if (ratio <= 0.15) return 'bg-danger';
  if (ratio <= 0.35) return 'bg-warning';
  return 'bg-success';
}

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
      setError(String(e));
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
      clearMobileSharedSessions();
      window.dispatchEvent(new CustomEvent('goodboy:bridge-paired-changed'));
      await mint();
    } catch (e) {
      setError(String(e));
    } finally {
      setRevoking(false);
    }
  }, [mint]);

  useEffect(() => {
    void mint();
  }, [mint]);

  useEffect(() => {
    if (!info) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [info]);

  useEffect(() => {
    if (info && remaining === 0 && !loading) {
      void mint();
    }
  }, [remaining, info, loading, mint]);

  const enrolled = status?.enrolledCount ?? 0;
  const total = totalRef.current || 1;

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
              <FlaskConical size={13} aria-hidden className="mt-0.5 shrink-0 text-warning" />
              <p className="text-2xs leading-relaxed text-warning">
                This feature is currently in testing. Contact the developer to get access before
                trying it out.
              </p>
            </div>

            {loading && !info ? (
              <div
                className="flex flex-col items-center gap-3.5"
                role="status"
                aria-label="Generating pairing code"
              >
                <Skeleton className="size-[244px] rounded-lg" />
                <div className="flex w-[244px] flex-col items-center gap-1.5">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
            ) : error ? (
              <div className="flex size-[300px] flex-col items-center justify-center gap-3">
                <p className="text-center text-xs text-danger">{error}</p>
                <button
                  type="button"
                  onClick={() => void mint()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-soft px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <RefreshCw size={13} aria-hidden /> Retry
                </button>
              </div>
            ) : info ? (
              <>
                <div className="flex flex-col items-center gap-3.5">
                  <div
                    className="size-[244px] rounded-lg border border-border-soft bg-white p-3.5 shadow-lg [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: info.svg }}
                  />
                  <div className="flex w-[244px] flex-col items-center gap-1.5">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft/60"
                      role="progressbar"
                      aria-valuenow={remaining}
                      aria-valuemin={0}
                      aria-valuemax={total}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300 motion-safe:ease-linear',
                          barColorClass(remaining, total),
                        )}
                        style={{ width: `${(Math.min(remaining, total) / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-2xs font-semibold tabular-nums text-muted-foreground">
                      Expires in {remaining}s
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void mint()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-soft px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <RefreshCw size={13} aria-hidden /> New code
                  </button>
                  <p className="max-w-[18rem] text-center text-2xs text-muted-foreground">
                    A new code is minted automatically when this one expires. Only one device can be
                    linked at a time.
                  </p>
                </div>

                {enrolled > 0 ? (
                  <div className="flex w-full flex-col gap-5">
                    <Divider />
                    <div className="flex w-full flex-col items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-2xs font-semibold text-success">
                        <span aria-hidden className="size-1.5 rounded-full bg-success" />
                        {enrolled} paired {enrolled === 1 ? 'device' : 'devices'}
                      </span>
                      <button
                        type="button"
                        disabled={revoking}
                        onClick={() => void revoke()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:border-danger/60 hover:bg-danger/15 disabled:opacity-50"
                      >
                        <Unplug size={13} aria-hidden />
                        {revoking ? 'Disconnecting…' : 'Disconnect phone'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
