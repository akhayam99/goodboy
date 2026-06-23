import { useState } from 'react';
import { Check, Copy, GitBranch } from 'lucide-react';

const COMMANDS = ['git branch -M main', 'git push -u origin main'] as const;

export const BaseBranchGuide = () => {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard.writeText(COMMANDS.join('\n')).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <GitBranch size={15} aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">No base branch on the remote</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Every session branches from <span className="font-mono">origin/main</span> (or{' '}
            <span className="font-mono">origin/master</span>), so that branch has to exist and be
            pushed before you can launch. Rename your default branch and push it once:
          </p>
        </div>
      </div>
      <div className="relative rounded-lg border border-border-soft bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
        {COMMANDS.map((cmd) => (
          <div key={cmd} className="whitespace-pre">
            <span className="select-none text-muted-foreground">$ </span>
            {cmd}
          </div>
        ))}
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy commands"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border-soft bg-background px-2 py-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
};
