import { Tooltip } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly divergence: string | null;
};

export const EffortNote = ({ label, divergence }: Props) => {
  if (divergence == null) {
    return (
      <span className="shrink-0 text-muted-foreground" title="Effort">
        {label}
      </span>
    );
  }
  return (
    <Tooltip content={divergence}>
      <span
        data-testid="effort-divergence"
        className="shrink-0 text-muted-foreground underline decoration-dotted underline-offset-2"
      >
        {label}
      </span>
    </Tooltip>
  );
};
