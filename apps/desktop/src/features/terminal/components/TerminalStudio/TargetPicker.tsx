import type { ReactNode } from 'react';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { TerminalTarget } from '../../terminalTargets';

type Props = {
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly label: string;
  readonly valueLabel: ReactNode;
  readonly disabledReason?: string;
  readonly onPick: (target: TerminalTarget) => void;
};

export const TargetPicker = ({ targets, label, valueLabel, disabledReason, onPick }: Props) => {
  const options: ReadonlyArray<ListboxOption<string>> = targets.map((target) => ({
    value: target.key,
    label: target.label,
    description: target.path,
    ...(target.group === undefined ? {} : { group: target.group }),
  }));
  return (
    <Listbox<string>
      options={options}
      value={null}
      trigger="quiet"
      size="sm"
      ariaLabel={label}
      valueLabel={valueLabel}
      popupWidth="content"
      {...(disabledReason === undefined ? {} : { disabled: true, disabledReason })}
      onChange={(key) => {
        const target = targets.find((candidate) => candidate.key === key);
        if (target !== undefined) {
          onPick(target);
        }
      }}
    />
  );
};
