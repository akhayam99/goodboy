import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { openCommandInExternalTerminal } from '../../external-terminal';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import { CopyButton } from '@goodboy/ui';

type Props = {
  readonly command: string;
  readonly providerId: ProviderId;
};

type PollParams = {
  readonly attempt: number;
  readonly baseline: string;
  readonly startedAt: number;
};

const POLL_DELAYS_MS = [3_000, 6_000, 12_000, 24_000] as const;
const MAX_POLL_DELAY_MS = 24_000;
const POLL_DURATION_MS = 120_000;

export const EscapeHatch = ({ command, providerId }: Props) => {
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current !== null) {
        window.clearTimeout(pollTimer.current);
      }
    };
  }, [providerId]);

  const onLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      await openCommandInExternalTerminal(command);
      if (pollTimer.current !== null) {
        window.clearTimeout(pollTimer.current);
      }
      const provider = useAppStore.getState().providers.find((item) => item.id === providerId);
      const baseline = `${provider?.connection ?? 'missing'}:${provider?.identity ?? ''}`;
      const startedAt = Date.now();
      const poll = async ({ attempt, baseline: initial, startedAt: start }: PollParams) => {
        await refreshProviders().catch(() => undefined);
        const current = useAppStore.getState().providers.find((item) => item.id === providerId);
        const signature = `${current?.connection ?? 'missing'}:${current?.identity ?? ''}`;
        if (signature !== initial) {
          pollTimer.current = null;
          return;
        }
        const nextAttempt = attempt + 1;
        const delayMs =
          POLL_DELAYS_MS[Math.min(nextAttempt, POLL_DELAYS_MS.length - 1)] ?? MAX_POLL_DELAY_MS;
        if (Date.now() - start + delayMs > POLL_DURATION_MS) {
          pollTimer.current = null;
          return;
        }
        pollTimer.current = window.setTimeout(
          () => void poll({ attempt: nextAttempt, baseline: initial, startedAt: start }),
          delayMs,
        );
      };
      pollTimer.current = window.setTimeout(
        () => void poll({ attempt: 0, baseline, startedAt }),
        POLL_DELAYS_MS[0],
      );
    } catch (err) {
      setLaunchError(formatError(err));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tooltip content="Copy command" side="top">
          <CopyButton
            presentation="icon"
            value={command}
            label="copy command"
            className="inline-flex items-center gap-1.5 rounded-md border border-border-soft px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span>Copy command</span>
          </CopyButton>
        </Tooltip>
        <Tooltip content="Open in your system terminal" side="top">
          <button
            type="button"
            disabled={launching}
            onClick={() => void onLaunch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-soft px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Terminal size={11} aria-hidden />
            <span>Run in my terminal</span>
          </button>
        </Tooltip>
      </div>
      {launchError ? (
        <span className="text-2xs text-danger">
          Could not open your system terminal: {launchError}
        </span>
      ) : null}
    </div>
  );
};
