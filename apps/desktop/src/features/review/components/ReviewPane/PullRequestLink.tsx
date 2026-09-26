import { ChevronRight } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly prNumber: number;
  readonly onOpen: () => void;
};

export const pullRequestLinkLabel = ({ prNumber }: { readonly prNumber: number }): string =>
  `PR #${prNumber}`;

export const PullRequestLink = ({ prNumber, onOpen }: Props) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label={`Open pull request #${prNumber}`}
    className="inline-flex shrink-0 items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-mono text-secondary text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
  >
    {pullRequestLinkLabel({ prNumber })}
    <ChevronRight size={ICON_SIZE.row} aria-hidden />
  </button>
);
