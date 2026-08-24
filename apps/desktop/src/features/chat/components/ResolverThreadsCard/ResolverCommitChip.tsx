import { GitCommit } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly sha: string;
  readonly onOpen: (() => void) | null;
};

const CHIP_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-md border border-border-soft px-1.5 py-0.5 font-mono text-2xs tabular-nums text-muted-foreground/80';

export const ResolverCommitChip = ({ sha, onOpen }: Props) => {
  const shortSha = sha.slice(0, 7);
  const content = (
    <>
      <GitCommit size={10} aria-hidden />
      {shortSha}
    </>
  );

  if (onOpen === null) {
    return <span className={CHIP_CLASS}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open commit ${shortSha}`}
      aria-label={`Open commit ${shortSha}`}
      className={cn(
        CHIP_CLASS,
        'cursor-pointer underline-offset-2 motion-safe:transition-colors hover:border-border hover:text-foreground hover:underline',
      )}
    >
      {content}
    </button>
  );
};
