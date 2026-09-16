import type { WireframeTheme } from '@goodboy/core';
import type { WireframeFidelity } from '../../wireframeFidelity';

type Props = {
  readonly fidelity: WireframeFidelity;
  readonly requestedFidelity: WireframeFidelity | null;
  readonly theme: WireframeTheme;
  readonly designProfile: Readonly<Record<string, unknown>>;
};

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
  const commit = asString(designProfile['commitSha']);
  const refs = [...new Set([...(theme.sources ?? []), ...profileRefs({ designProfile })])];
  const isDiverged = requestedFidelity !== null && requestedFidelity !== fidelity;

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
        <>
          <span className="shrink-0">from</span>
          {refs.map((ref) => (
            <span key={ref} className="truncate font-mono">
              {ref}
            </span>
          ))}
        </>
      )}
    </div>
  );
};
