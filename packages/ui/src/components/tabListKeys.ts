import type { KeyboardEvent, RefObject } from 'react';

type Enabled = { readonly disabled?: boolean };

type NavigationParams = {
  readonly options: ReadonlyArray<Enabled>;
  readonly startIndex: number;
  readonly direction: -1 | 1;
};

export const nextEnabledIndex = ({ options, startIndex, direction }: NavigationParams): number => {
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (startIndex + direction * offset + options.length) % options.length;
    if (options[index]?.disabled !== true) {
      return index;
    }
  }
  return startIndex;
};

type ArrowParams<T extends string> = {
  readonly event: KeyboardEvent;
  readonly index: number;
  readonly options: ReadonlyArray<Enabled & { readonly value: T }>;
  readonly tablistRef: RefObject<HTMLDivElement | null>;
  readonly onChange: (value: T) => void;
};

export const moveTabFocus = <T extends string>({
  event,
  index,
  options,
  tablistRef,
  onChange,
}: ArrowParams<T>): void => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }
  event.preventDefault();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = nextEnabledIndex({ options, startIndex: index, direction });
  const nextOption = options[nextIndex];
  if (nextOption == null || nextOption.disabled === true || nextIndex === index) {
    return;
  }
  onChange(nextOption.value);
  tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
};
