import { GitCommitHorizontal } from 'lucide-react';
import { SectionHeader, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RESOLVE_ITEM_LABEL, shortSha } from '../../resolveItemCopy';

type Props = {
  readonly sha: string;
  readonly onOpenCommit: (params: { readonly sha: string }) => void;
};

export const FIXED_IN_LABEL = 'Fixed in';

export const ResolveCommitLine = ({ sha, onOpenCommit }: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <SectionHeader label={RESOLVE_ITEM_LABEL.commit} headingLevel={3} />
    <span className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground">
      {FIXED_IN_LABEL}
      <Tooltip content={sha} side="top">
        <button
          type="button"
          onClick={() => onOpenCommit({ sha })}
          className="inline-flex items-center gap-1 rounded-sm font-mono tabular-nums text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <GitCommitHorizontal size={ICON_SIZE.row} aria-hidden />
          {shortSha({ sha })}
        </button>
      </Tooltip>
    </span>
  </div>
);
