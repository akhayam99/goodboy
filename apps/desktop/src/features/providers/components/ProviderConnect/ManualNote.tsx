import { ExternalLink } from 'lucide-react';

type Props = {
  readonly reason: string;
  readonly docsUrl: string;
  readonly docsLabel: string;
};

export const ManualNote = ({ reason, docsUrl, docsLabel }: Props) => {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle/30 p-4">
      <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{reason}</p>
      <a
        href={docsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{docsLabel}</span>
        <ExternalLink size={10} aria-hidden />
      </a>
    </div>
  );
};
