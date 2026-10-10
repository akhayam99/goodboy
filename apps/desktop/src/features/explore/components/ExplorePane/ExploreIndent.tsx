type Props = {
  readonly depth: number;
};

export const ExploreIndent = ({ depth }: Props) => {
  if (depth === 0) {
    return null;
  }
  return (
    <span aria-hidden className="flex h-full shrink-0">
      {Array.from({ length: depth }, (_, level) => (
        <span
          key={level}
          className="h-full w-4 shrink-0 border-l border-transparent group-hover/explore-row:border-border-soft"
        />
      ))}
    </span>
  );
};
