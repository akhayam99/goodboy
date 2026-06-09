import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { openCommandInExternalTerminal } from '../../external-terminal';
import { formatError } from '../../../../shared/lib/errors';

type Props = {
  readonly command: string;
};

const RESET_AFTER_MS = 1500;

export const EscapeHatch = ({ command }: Props) => {
  const [copied, setCopied] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), RESET_AFTER_MS);
    } catch {
      setCopied(false);
    }
  };

  const onLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      await openCommandInExternalTerminal(command);
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
          <button
            type="button"
            onClick={() => void onCopy()}
            aria-label="copy command"
            className="inline-flex items-center gap-1.5 rounded-md border border-border-soft px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <>
                <Check size={11} aria-hidden />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} aria-hidden />
                <span>Copy command</span>
              </>
            )}
          </button>
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
