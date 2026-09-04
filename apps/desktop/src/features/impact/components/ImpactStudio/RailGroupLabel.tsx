import { Divider, Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count?: number;
};

export const RailGroupLabel = ({ label, count }: Props) => (
  <div className="flex items-center gap-1.5 px-1 pb-0.5">
    <Eyebrow label={label} />
    {count === undefined ? null : (
      <span className="text-2xs tabular-nums text-muted-foreground/50">{count}</span>
    )}
    <Divider className="w-auto min-w-0 flex-1" />
  </div>
);
