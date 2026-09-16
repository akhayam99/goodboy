import { useState } from 'react';
import { cn } from '@goodboy/ui';
import type { WireframeTheme } from '@goodboy/core';
import type { WireframeFidelity } from '../../wireframeFidelity';

type Props = {
  readonly fidelity: WireframeFidelity;
  readonly requestedFidelity: WireframeFidelity | null;
  readonly theme: WireframeTheme;
  readonly designProfile: Readonly<Record<string, unknown>>;
};

const COLLAPSED_LIMIT = 4;

const chipClass =
  'inline-flex min-w-0 max-w-[13rem] items-center rounded-full border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground';

const refLeaf = ({ ref }: { readonly ref: string }): string =>
  ref
    .split('/')
    .filter((segment) => segment.length > 0)
    .pop() ?? ref;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const profileRefs = ({
  designProfile,
}: {
  readonly designProfile: Readonly<Record<string, unknown>>;
}): ReadonlyArray<string> => {
  const raw = designProfile['sources'] ?? designProfile['refs'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null)
    .slice(0, 12);
};

export const WireframeProvenanceRow = ({
  fidelity,
  requestedFidelity,
  theme,
  designProfile,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const commit = asString(designProfile['commitSha']);
  const refs = [...new Set([...(theme.sources ?? []), ...profileRefs({ designProfile })])];
  const isDiverged = requestedFidelity !== null && requestedFidelity !== fidelity;
  const overflow = refs.length - COLLAPSED_LIMIT;
  const visible = isExpanded || overflow <= 0 ? refs : refs.slice(0, COLLAPSED_LIMIT);

  return (
    <div
      data-testid="wireframe-provenance"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground"
    >
      {isDiverged ? (
        <span
          data-testid="wireframe-fidelity-divergence"
          className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 uppercase tracking-wide text-warning"
        >
          {requestedFidelity} fidelity asked, {fidelity} fidelity produced
        </span>
      ) : (
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">
          {fidelity} fidelity
        </span>
      )}
      <span className="shrink-0">theme {theme.name}</span>
      {commit === null ? null : <span className="shrink-0 tabular-nums">at {commit}</span>}
      {refs.length === 0 ? (
        <span className="shrink-0">no design evidence was pinned to this wireframe</span>
      ) : (
        <span className="shrink-0">from</span>
      )}
      {visible.map((ref) => (
        <span
          key={ref}
          data-testid="wireframe-source-chip"
          title={ref}
          aria-label={ref}
          className={cn(chipClass, 'font-mono')}
        >
          <span className="truncate">{refLeaf({ ref })}</span>
        </span>
      ))}
      {overflow > 0 && !isExpanded && (
        <button
          type="button"
          className={cn(
            chipClass,
            'shrink-0 tabular-nums hover:border-border hover:text-foreground',
          )}
          data-testid="wireframe-sources-more"
          onClick={() => setIsExpanded(true)}
        >
          +{overflow} more
        </button>
      )}
      {overflow > 0 && isExpanded && (
        <button
          type="button"
          className={cn(chipClass, 'shrink-0 hover:border-border hover:text-foreground')}
          data-testid="wireframe-sources-less"
          onClick={() => setIsExpanded(false)}
        >
          show fewer
        </button>
      )}
    </div>
  );
};
