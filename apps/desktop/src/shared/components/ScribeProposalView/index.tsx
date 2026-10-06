import { useState } from 'react';
import { Button, Markdown } from '@goodboy/ui';
import { RotateCw } from 'lucide-react';
import { ICON_SIZE } from '../conceptIcons';
import type { ScribeProposal } from '../../utils/scribeProposal';
import type { ScribeProposalState } from '../../hooks/useScribeProposal';
import { ScribeProposalChip } from './ScribeProposalChip';

type Props = {
  readonly proposal: Pick<ScribeProposal, 'title' | 'body' | 'changelogEntry'>;
  readonly state: ScribeProposalState | null;
  readonly canRetry: boolean;
  readonly isCompact: boolean;
  readonly hasHeader: boolean;
  readonly onRetry: () => void;
};

const LONG_BODY_LINES = 6;

export const ScribeProposalView = ({
  proposal,
  state,
  canRetry,
  isCompact,
  hasHeader,
  onRetry,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const isClamped = isCompact && !isOpen;
  const hasLongBody = proposal.body !== null && proposal.body.split('\n').length > LONG_BODY_LINES;
  return (
    <section
      aria-label={hasHeader ? 'Pull request text' : undefined}
      data-testid="scribe-proposal"
      className="flex max-w-[var(--measure)] flex-col gap-2"
    >
      {hasHeader ? (
        <header className="flex items-center justify-between gap-3">
          <span className="text-label text-muted-foreground">Pull request text</span>
          <ScribeProposalChip state={state} />
        </header>
      ) : null}
      {proposal.title !== null ? (
        <p className="text-row text-foreground">{proposal.title}</p>
      ) : null}
      {proposal.body !== null ? (
        <div className="flex flex-col items-start gap-1">
          <div className={isClamped && hasLongBody ? 'max-h-40 overflow-hidden' : undefined}>
            <Markdown text={proposal.body} />
          </div>
          {isCompact && hasLongBody ? (
            <Button variant="ghost" size="sm" onClick={() => setIsOpen((open) => !open)}>
              {isOpen ? 'Show less' : 'Show all'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {proposal.changelogEntry !== null ? (
        <div className="flex flex-col gap-1">
          <span className="text-meta text-muted-foreground">Changelog entry</span>
          <pre className="whitespace-pre-wrap rounded-md bg-muted px-2 py-1 font-mono text-chip text-foreground">
            {proposal.changelogEntry}
          </pre>
        </div>
      ) : null}
      {state?.kind === 'failed' ? (
        <p role="alert" className="text-label text-danger">
          {state.reason}
        </p>
      ) : null}
      {canRetry ? (
        <div>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw size={ICON_SIZE.row} aria-hidden />
            {state?.kind === 'failed' ? 'Retry' : 'Create PR'}
          </Button>
        </div>
      ) : null}
    </section>
  );
};
