import { useState } from 'react';
import { Check, GitBranch } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';

export const BranchChip = ({ branch }: { branch: string }) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(branch);
      setCopied(true);
      showToast('success', 'branch copied');
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      showToast('error', `copy failed: ${formatError(err)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title="click to copy branch name"
      className={cn(
        'group inline-flex min-w-0 max-w-full shrink items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-2xs transition-colors',
        copied
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border-soft bg-muted/30 text-foreground/80 hover:border-border hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {copied ? (
        <Check size={10} aria-hidden className="shrink-0" />
      ) : (
        <GitBranch
          size={10}
          aria-hidden
          className="shrink-0 text-muted-foreground group-hover:text-foreground"
        />
      )}
      <span className="truncate">{branch}</span>
    </button>
  );
};
