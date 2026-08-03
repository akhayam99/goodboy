import { ResolverOutcomeChip } from '../../../session/components/AgentInspector/ResolverOutcomeChip';
import { TranscriptShell } from '../TranscriptShell';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import type { ResolverThreadVerdict } from './resolverThreadVerdicts';

type Props = {
  readonly verdict: ResolverThreadVerdict;
  readonly position: number;
  readonly nested: boolean;
  readonly onOpen: (() => void) | null;
  readonly 'data-testid'?: string;
};

export const ResolverThreadVerdictRow = ({
  verdict,
  position,
  nested,
  onOpen,
  'data-testid': testId,
}: Props) => {
  const content = (
    <>
      <ResolverOutcomeChip kind={verdict.kind} isClosed={verdict.isClosed} />
      <span className="shrink-0 text-2xs text-muted-foreground/70">thread {position}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">{verdict.text}</span>
    </>
  );

  if (onOpen === null) {
    return (
      <TranscriptShell
        tone="success"
        variant="leftBorder"
        nested={nested}
        data-testid={testId}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        {content}
      </TranscriptShell>
    );
  }

  return (
    <TranscriptShell
      as="button"
      type="button"
      tone="success"
      variant="leftBorder"
      nested={nested}
      onClick={onOpen}
      aria-label={`open thread ${position} in the resolver inspector`}
      data-testid={testId}
      className={`flex w-full min-w-0 items-center gap-2 text-left ${TRANSCRIPT_ROW_HOVER}`}
    >
      {content}
    </TranscriptShell>
  );
};
