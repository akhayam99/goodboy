import type { ReactNode } from 'react';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { TerminalTarget } from '../../terminalTargets';

type Props = {
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly label: string;
  readonly valueLabel: ReactNode;
  readonly onPick: (target: TerminalTarget) => void;
};

export const TargetPicker = ({ targets, label, valueLabel, onPick }: Props) => {
  const options: ReadonlyArray<ListboxOption<string>> = targets.map((target) => ({
    value: target.key,
    label: target.label,
    description: target.path,
  }));
  return (
    <Listbox<string>
      options={options}
      value={null}
      trigger="quiet"
      size="sm"
      ariaLabel={label}
      valueLabel={valueLabel}
      align="end"
      popupWidth="content"
      onChange={(key) => {
        const target = targets.find((candidate) => candidate.key === key);
        if (target !== undefined) {
          onPick(target);
        }
      }}
    />
  );
};
