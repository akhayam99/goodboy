import { useState } from 'react';
import { ExternalLink, SquareTerminal } from 'lucide-react';
import { Button, CopyButton, Reveal, useEscapeLayer } from '@goodboy/ui';
import { InlineTerminal } from '../../../providers/components/InlineTerminal';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import type { AgentRow } from '../agentRowOf';
import { TerminalLines } from './TerminalLines';

type Props = {
  readonly row: AgentRow;
  readonly isLocked: boolean;
  readonly onRun: () => void;
};

export const AgentRowPanel = ({ row, isLocked, onRun }: Props) => {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  useEscapeLayer(() => setIsTerminalOpen(false), isTerminalOpen);

  if (row.state === 'missing' && row.installCommand !== null) {
    return (
      <div className="flex flex-col gap-2 rounded-md bg-background px-3 py-2">
        <span className="text-label text-muted-foreground">
          Goodboy runs this in a terminal here:
        </span>
        <div className="flex items-center justify-between gap-2">
          <code className="min-w-0 truncate rounded-sm bg-fill px-2 py-0.5 text-code text-foreground">
            {row.installCommand}
          </code>
          <span className="flex shrink-0 items-center gap-1">
            <CopyButton value={row.installCommand} presentation="icon" label="Copy command" />
            <Button
              size="xs"
              variant="secondary"
              disabled={isLocked}
              aria-label={`Run the ${row.label} install`}
              onClick={onRun}
            >
              <SquareTerminal size={ICON_SIZE.control} aria-hidden />
              Run
            </Button>
          </span>
        </div>
      </div>
    );
  }

  if (row.state === 'manual') {
    const docsUrl = row.docsUrl;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
        <span className="min-w-0 text-label text-muted-foreground">
          Install {row.product} and sign in there. This row turns ready when you come back to this
          window.
        </span>
        {docsUrl === null ? null : (
          <Button size="xs" variant="ghost" onClick={() => void openUrl(docsUrl)}>
            <ExternalLink size={ICON_SIZE.control} aria-hidden />
            How to install
          </Button>
        )}
      </div>
    );
  }

  if (row.state === 'broken') {
    return (
      <TerminalLines command={`${row.binary} --version`}>
        <span className="text-foreground">
          {row.output ?? 'It stopped without printing a reason.'}
        </span>
        <span className="text-faint-foreground">
          Fix it in Terminal, then Check again. Goodboy runs the same CLI you run.
        </span>
      </TerminalLines>
    );
  }

  if (row.state === 'failed') {
    return (
      <TerminalLines command={row.runCommand}>
        <span className="text-foreground">{row.output ?? 'It stopped before signing in.'}</span>
      </TerminalLines>
    );
  }

  if (row.state !== 'signing' && row.state !== 'installing') {
    return null;
  }

  const authUrl = row.authUrl;
  const runId = row.runId;
  return (
    <div className="flex flex-col gap-2">
      <TerminalLines command={row.runCommand}>
        {row.progress === null ? null : <span>{row.progress}</span>}
        {authUrl === null ? null : (
          <span>
            Browser did not open?{' '}
            <CopyButton
              value={authUrl}
              label="Copy the sign-in link"
              presentation="icon"
              className="gap-1 p-0 text-primary"
            >
              Copy the sign-in link
            </CopyButton>
          </span>
        )}
      </TerminalLines>
      {runId === null ? null : (
        <div className="flex flex-col gap-2">
          <Button
            size="xs"
            variant="quiet"
            className="self-start"
            aria-expanded={isTerminalOpen}
            onClick={() => setIsTerminalOpen((isOpen) => !isOpen)}
          >
            {isTerminalOpen ? 'Hide the terminal' : 'Show the terminal'}
          </Button>
          <Reveal open={isTerminalOpen}>
            <InlineTerminal runId={runId} isActive={isTerminalOpen} heightClass="h-44" />
          </Reveal>
        </div>
      )}
    </div>
  );
};
