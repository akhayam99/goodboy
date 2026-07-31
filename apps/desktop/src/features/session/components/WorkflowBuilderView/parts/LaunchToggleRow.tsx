import { Switch } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly disabled: boolean;
  readonly beta?: boolean;
};

export const LaunchToggleRow = ({
  title,
  description,
  checked,
  onChange,
  disabled,
  beta,
}: Props) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
    <p className="min-w-0 text-2xs leading-relaxed text-muted-foreground/60">{description}</p>
    <Switch label={title} beta={beta} checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);
