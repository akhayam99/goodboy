import { Listbox, type ListboxOption } from '@goodboy/ui';

type Props<T extends string> = {
  readonly label: string;
  readonly value: T;
  readonly options: ReadonlyArray<ListboxOption<T>>;
  readonly onChange: (value: T) => void;
};

export const DisplayValueRow = <T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) => (
  <div data-display-row={label} className="flex min-h-7 items-center gap-2 pl-2">
    <span aria-hidden className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
      {label}
    </span>
    <Listbox
      trigger="quiet"
      size="sm"
      ariaLabel={label}
      value={value}
      options={options}
      onChange={onChange}
    />
  </div>
);
