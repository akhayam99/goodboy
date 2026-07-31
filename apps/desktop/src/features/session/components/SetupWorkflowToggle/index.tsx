import { Checkbox } from '@goodboy/ui';

type Props = {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (next: boolean) => void;
};

export const SetupWorkflowToggle = ({ checked, disabled, onChange }: Props) => (
  <Checkbox
    label="Set up workflow next"
    checked={checked}
    disabled={disabled}
    onChange={onChange}
    className="text-2xs text-muted-foreground"
  />
);
