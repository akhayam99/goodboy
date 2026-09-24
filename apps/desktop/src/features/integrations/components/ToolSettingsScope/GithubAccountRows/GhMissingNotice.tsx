import { ExternalLink, TriangleAlert } from 'lucide-react';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

export const GhMissingNotice = () => (
  <p className="flex items-center gap-1.5 text-xs text-warning">
    <TriangleAlert size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    <span>
      The GitHub CLI is not installed.{' '}
      <a
        href="https://cli.github.com"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
      >
        Install gh <ExternalLink size={10} aria-hidden />
      </a>
    </span>
  </p>
);
