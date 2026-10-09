import { Chip } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly isOn: boolean;
  readonly onChange: (next: boolean) => void;
};

export const FilterChip = ({ label, isOn, onChange }: Props) => (
  <Chip
    as="button"
    kind="reference"
    tone="neutral"
    label={label}
    ariaPressed={isOn}
    className={isOn ? 'bg-selected text-foreground ring-transparent' : undefined}
    onClick={() => onChange(!isOn)}
  />
);
