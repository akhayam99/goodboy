import { SquareArrowOutUpRight, TriangleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE } from '@goodboy/ui';

export const GhMissingNotice = () => (
  <p className="flex items-center gap-2 text-meta text-warning">
    <TriangleAlert size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    <span>
      The GitHub CLI isn't installed.{' '}
      <a
        href="https://cli.github.com"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
      >
        Install gh <SquareArrowOutUpRight size={ICON_SIZE.mark} aria-hidden />
      </a>
    </span>
  </p>
);
