type Props = {
  readonly diff: {
    readonly additions: number;
    readonly deletions: number;
  };
};

export const DiffStatText = ({ diff }: Props) => (
  <span data-diff-stat="">{`+${diff.additions} -${diff.deletions}`}</span>
);
