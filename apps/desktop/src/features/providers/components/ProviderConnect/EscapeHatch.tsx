import { useEffect, useRef, useState } from 'react';
import { Button, formatError, ICON_SIZE, Tooltip } from '@goodboy/ui';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { openCommandInExternalTerminal } from '../../external-terminal';
import { useAppStore } from '../../../../store';
import { CopyButton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { SETTING_TERMINAL_APP } from '../../../settings/settings';
import { commandTerminalLabel } from '../../commandTerminalLabel';

type Props = {
  readonly command: string;
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
};

type PollParams = {
  readonly attempt: number;
  readonly baseline: string;
  readonly startedAt: number;
};

const POLL_DELAYS_MS = [3_000, 6_000, 12_000, 24_000] as const;
const MAX_POLL_DELAY_MS = 24_000;
const POLL_DURATION_MS = 120_000;

export const EscapeHatch = ({ command, providerId, action }: Props) => {
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const terminalLabel = useAppStore((state) =>
    commandTerminalLabel({
      saved: state.settings[SETTING_TERMINAL_APP],
      detected: state.detectedTerminals,
    }),
  );
  const loadDetectedTerminals = useAppStore((state) => state.loadDetectedTerminals);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    void loadDetectedTerminals();
  }, [loadDetectedTerminals]);

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
      await openCommandInExternalTerminal({ providerId, action });
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip content="Copy command" side="top">
          <CopyButton
            presentation="icon"
            value={command}
            label="copy command"
            className="h-7 gap-2 border border-border bg-muted px-3 text-meta font-medium text-foreground hover:bg-hover hover:text-foreground"
          >
            <span>Copy command</span>
          </CopyButton>
        </Tooltip>
        <Tooltip content={`Open in ${terminalLabel}`} side="top">
          <Button
            variant="secondary"
            size="sm"
            disabled={launching}
            onClick={() => void onLaunch()}
          >
            <CONCEPT_ICONS.terminal size={ICON_SIZE.row} aria-hidden />
            <span>Open in {terminalLabel}</span>
          </Button>
        </Tooltip>
      </div>
      {launchError ? (
        <span className="text-meta text-danger">
          Could not open your system terminal: {launchError}
        </span>
      ) : null}
    </div>
  );
};
