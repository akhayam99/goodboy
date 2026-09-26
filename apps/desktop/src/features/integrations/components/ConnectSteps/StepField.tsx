import { Input } from '@goodboy/ui';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: 'text' | 'email' | 'password';
  readonly isDisabled?: boolean;
  readonly shouldAutoFocus?: boolean;
};

export const StepField = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  isDisabled = false,
  shouldAutoFocus = false,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    <label htmlFor={id} className="text-label text-foreground">
      {label}
    </label>
    <Input
      id={id}
      type={type}
      autoFocus={shouldAutoFocus}
      placeholder={placeholder}
      value={value}
      disabled={isDisabled}
      onChange={(event) => onChange(event.target.value)}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
    />
  </div>
);
