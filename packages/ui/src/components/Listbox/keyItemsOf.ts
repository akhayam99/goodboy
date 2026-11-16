import type { FilteredOption } from './filterOptions';
import type { ListboxValue } from './listboxTypes';
import type { ListboxKeyItem } from './useListboxKeyboard';

type Params<T extends ListboxValue> = {
  readonly entries: ReadonlyArray<FilteredOption<T>>;
  readonly createLabel: string | undefined;
};

export const keyItemsOf = <T extends ListboxValue>({
  entries,
  createLabel,
}: Params<T>): ReadonlyArray<ListboxKeyItem> => [
  ...entries.map(({ option }) => ({
    key: `${typeof option.value}:${String(option.value)}`,
    label: option.label,
    isDisabled: option.disabledReason !== undefined,
    ...(option.star !== undefined &&
      option.star.isBusy !== true && { onStar: option.star.onToggle }),
  })),
  ...(createLabel === undefined ? [] : [{ label: createLabel, isDisabled: false }]),
];
