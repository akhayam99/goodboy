import { useState } from 'react';
import { Chip, EmptyLine, Eyebrow } from '@goodboy/ui';
import type { WireframeTheme } from '@goodboy/core/artifacts';
import type { WireframeFidelity } from '../../wireframeFidelity';

type Props = {
  readonly fidelity: WireframeFidelity;
  readonly theme: WireframeTheme;
  readonly designProfile: Readonly<Record<string, unknown>>;
};

const COLLAPSED_LIMIT = 4;

type RefParams = {
  readonly ref: string;
};

const refLeaf = ({ ref }: RefParams): string =>
  ref
    .split('/')
    .filter((segment) => segment.length > 0)
    .pop() ?? ref;

type ValueParams = {
  readonly value: unknown;
};

const asString = ({ value }: ValueParams): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const profileRefs = ({ designProfile }: Pick<Props, 'designProfile'>): ReadonlyArray<string> => {
  const raw = designProfile['sources'] ?? designProfile['refs'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => asString({ value: entry }))
    .filter((entry): entry is string => entry !== null)
    .slice(0, 12);
};

export const WireframeProvenanceRow = ({ fidelity, theme, designProfile }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const commit = asString({ value: designProfile['commitSha'] });
  const refs = [...new Set([...(theme.sources ?? []), ...profileRefs({ designProfile })])];
  const overflow = refs.length - COLLAPSED_LIMIT;
  const visible = isExpanded || overflow <= 0 ? refs : refs.slice(0, COLLAPSED_LIMIT);

  return (
    <div
      data-testid="wireframe-provenance"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground"
    >
      <Eyebrow
        label={`${fidelity} fidelity`}
        className="shrink-0 rounded-sm bg-muted px-2 py-0.5"
      />
      <span className="shrink-0">theme {theme.name}</span>
      {commit === null ? null : <span className="shrink-0 tabular-nums">at {commit}</span>}
      {refs.length === 0 ? (
        <EmptyLine className="min-h-0 shrink-0">No design evidence was pinned</EmptyLine>
      ) : (
        <span className="shrink-0">from</span>
      )}
      {visible.map((ref) => (
        <Chip
          key={ref}
          kind="reference"
          tone="neutral"
          title={ref}
          testId="wireframe-source-chip"
          className="min-w-0 max-w-[13rem] shrink font-mono"
          label={<span className="truncate">{refLeaf({ ref })}</span>}
        />
      ))}
      {overflow > 0 && !isExpanded && (
        <Chip
          as="button"
          kind="reference"
          tone="neutral"
          testId="wireframe-sources-more"
          className="tabular-nums"
          label={`+${overflow} more`}
          onClick={() => setIsExpanded(true)}
        />
      )}
      {overflow > 0 && isExpanded && (
        <Chip
          as="button"
          kind="reference"
          tone="neutral"
          testId="wireframe-sources-less"
          label="Show fewer"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};
