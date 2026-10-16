import type { ReactNode } from 'react';
import { FieldRow, Listbox } from '@goodboy/ui';

export type ToolChoice = {
  readonly value: string;
  readonly label: string;
  readonly mark?: ReactNode;
};

type Props = {
  readonly label: string;
  readonly help: string;
  readonly value: string;
  readonly choices: ReadonlyArray<ToolChoice>;
  readonly onChange: (value: string) => void;
};

export const ToolChoiceField = ({ label, help, value, choices, onChange }: Props) => (
  <FieldRow label={label} help={help}>
    <Listbox
      size="sm"
      value={value}
      options={choices.map((choice) => ({
        value: choice.value,
        label: choice.label,
        ...(choice.mark === undefined ? {} : { leading: choice.mark }),
      }))}
      onChange={onChange}
      ariaLabel={label}
      {...(choices.length < 2 && {
        disabled: true,
        disabledReason: `Goodboy found only ${choices[0]?.label ?? 'one choice'} on this computer`,
      })}
    />
  </FieldRow>
);
