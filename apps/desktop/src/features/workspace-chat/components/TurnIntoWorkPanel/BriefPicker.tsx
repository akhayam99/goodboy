import { Check, ChevronDown } from 'lucide-react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type BriefPickerOption = {
  readonly value: string;
  readonly label: string;
};

type Props = {
  readonly label: string;
  readonly value: string | null;
  readonly options: ReadonlyArray<BriefPickerOption>;
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
};

export const BriefPicker = ({ label, value, options, placeholder, onChange }: Props) => {
  const current = options.find((option) => option.value === value)?.label ?? placeholder;
  const items: ReadonlyArray<OverflowMenuItem> =
    options.length === 0
      ? [{ kind: 'empty', key: 'empty', label: placeholder }]
      : options.map((option) => ({
          kind: 'item',
          key: option.value,
          label: option.label,
          ...(option.value === value && { icon: Check, tone: 'primary' }),
          onClick: () => onChange(option.value),
        }));
  return (
    <OverflowMenu
      items={items}
      label={label}
      tooltip={label}
      triggerClassName="flex h-7 max-w-full items-center gap-1 rounded-md border border-border-soft bg-background px-2 text-label text-foreground"
      trigger={
        <>
          <span className="min-w-0 truncate">{current}</span>
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
        </>
      }
    />
  );
};
