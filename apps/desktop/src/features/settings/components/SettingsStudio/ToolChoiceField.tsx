import type { ReactNode } from 'react';
import { Listbox } from '@goodboy/ui';
import type { SettingSave } from '../../hooks/useSettingSave';
import { SettingRow } from './SettingRow';

export type ToolChoice = {
  readonly value: string;
  readonly label: string;
  readonly mark?: ReactNode;
};

type Props = {
  readonly label: string;
  readonly rowKey: string;
  readonly help: ReactNode;
  readonly value: string;
  readonly defaultValue?: string;
  readonly choices: ReadonlyArray<ToolChoice>;
  readonly save?: Pick<SettingSave<unknown>, 'error' | 'isSaving' | 'retry'>;
  readonly onChange: (value: string) => void;
};

export const ToolChoiceField = ({
  label,
  rowKey,
  help,
  value,
  defaultValue,
  choices,
  save,
  onChange,
}: Props) => (
  <SettingRow
    label={label}
    rowKey={rowKey}
    help={help}
    isChanged={defaultValue !== undefined && value !== defaultValue}
    onReset={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
    save={save}
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
