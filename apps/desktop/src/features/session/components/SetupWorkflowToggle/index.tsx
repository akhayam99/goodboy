type Props = {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (next: boolean) => void;
};

export const SetupWorkflowToggle = ({ checked, disabled, onChange }: Props) => (
  <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-muted-foreground">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="accent-primary"
      disabled={disabled}
    />
    Set up workflow next
  </label>
);
