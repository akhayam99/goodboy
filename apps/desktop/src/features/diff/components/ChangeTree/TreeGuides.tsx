export const TREE_BASE_PX = 8;
export const TREE_INDENT_PX = 8;

type Props = {
  readonly depth: number;
};

export const TreeGuides = ({ depth }: Props) => (
  <>
    {Array.from({ length: depth }, (_, level) => (
      <i
        key={level}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-px bg-border-soft"
        style={{ left: TREE_BASE_PX + level * TREE_INDENT_PX + 6 }}
      />
    ))}
  </>
);
