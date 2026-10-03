import type { ReactNode } from 'react';
import { FieldRow, Listbox, SegmentedTabs } from '@goodboy/ui';

const SEGMENTED_CHOICE_MAX = 4;

export type ToolChoice = {
  readonly value: string;
  readonly label: string;
  readonly mark: ReactNode;
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
    {choices.length <= SEGMENTED_CHOICE_MAX ? (
      <SegmentedTabs
        size="sm"
        value={value}
        options={choices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          glyph: choice.mark,
        }))}
        onChange={onChange}
        ariaLabel={label}
      />
    ) : (
      <Listbox
        size="sm"
        value={value}
        options={choices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          leading: choice.mark,
        }))}
        onChange={onChange}
        ariaLabel={label}
      />
    )}
  </FieldRow>
);
