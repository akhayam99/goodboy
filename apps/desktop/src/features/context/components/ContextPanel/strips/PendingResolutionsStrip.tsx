import { useEffect, useState } from 'react';
import { ArrowUpRight, Upload } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';

export function PendingResolutionsStrip({ sessionId }: { sessionId: SessionId }) {
  const pending = useAppStore((s) => s.sessionPendingResolutions[sessionId] ?? EMPTY_ARRAY);
  const loadPendingResolutions = useAppStore((s) => s.loadPendingResolutions);
  const pushAllResolutions = useAppStore((s) => s.pushAllResolutions);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPendingResolutions(sessionId);
  }, [sessionId, loadPendingResolutions]);

  const count = pending.length;
  if (count === 0) return null;

  const onPush = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await pushAllResolutions(sessionId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onPush()}
      disabled={busy}
      title="push the branch once, then reply and resolve every queued review comment"
      className={cn(
        'relative flex w-full items-center justify-between gap-2 rounded-lg bg-accent/5 px-3 py-2 text-xs text-accent ring-1 ring-accent/20 motion-safe:transition-colors hover:bg-accent/10 disabled:cursor-default disabled:opacity-60',
        busy && 'animate-border-pulse',
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Upload size={12} aria-hidden />
        <span className="truncate font-medium">
          Push &amp; resolve {count} comment{count === 1 ? '' : 's'}
        </span>
      </span>
      <ArrowUpRight size={12} aria-hidden className="shrink-0 opacity-70" />
    </button>
  );
}
