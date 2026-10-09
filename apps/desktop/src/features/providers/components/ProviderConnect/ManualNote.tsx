import { ExternalLink } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly reason: string;
  readonly docsUrl: string;
  readonly docsLabel: string;
};

export const ManualNote = ({ reason, docsUrl, docsLabel }: Props) => {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle p-4">
      <p className="max-w-prose text-label text-muted-foreground">{reason}</p>
      <a
        href={docsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-meta text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{docsLabel}</span>
        <ExternalLink size={ICON_SIZE.mark} aria-hidden />
      </a>
    </div>
  );
};
