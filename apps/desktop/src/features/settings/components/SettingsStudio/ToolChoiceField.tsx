import type { ReactNode } from 'react';
import { Listbox } from '@goodboy/ui';
import { SettingRow } from './SettingRow';

export type ToolChoice = {
  readonly value: string;
  readonly label: string;
  readonly mark?: ReactNode;
};

type Props = {
  readonly label: string;
  readonly help: string;
  readonly value: string;
  readonly defaultValue?: string;
  readonly choices: ReadonlyArray<ToolChoice>;
  readonly onChange: (value: string) => void;
};

export const ToolChoiceField = ({ label, help, value, defaultValue, choices, onChange }: Props) => (
  <SettingRow
    label={label}
    help={help}
    isChanged={defaultValue !== undefined && value !== defaultValue}
    onReset={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
  >
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
  </SettingRow>
);
