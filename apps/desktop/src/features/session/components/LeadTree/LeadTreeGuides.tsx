type Params = {
  readonly depth: number;
  readonly unit?: number;
  readonly origin?: number;
};

export const LEAD_TREE_UNIT = 16;

export const LEAD_TREE_ORIGIN = 16;

export const LeadTreeGuides = ({
  depth,
  unit = LEAD_TREE_UNIT,
  origin = LEAD_TREE_ORIGIN,
}: Params) => (
  <>
    {Array.from({ length: depth }, (_, level) => (
      <span
        key={level}
        aria-hidden
        data-lead-tree-guide=""
        className="pointer-events-none absolute inset-y-0 w-px bg-border-soft"
        style={{ left: origin + level * unit }}
      />
    ))}
  </>
);
