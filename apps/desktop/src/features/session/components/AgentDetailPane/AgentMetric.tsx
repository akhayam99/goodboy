import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly value: string;
};

export const AgentMetric = ({ label, value }: Props) => (
  <span className="inline-flex items-baseline gap-1">
    <Eyebrow label={label} muted />
    <span className="text-2xs text-foreground">{value}</span>
  </span>
);
