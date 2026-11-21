import type { RefObject } from 'react';
import { useListKeys } from '../useListKeys';

type Params = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly rowSelector: string;
  readonly onSearch?: () => void;
};

const NO_KEYS: ReadonlyArray<string> = [];

export const useRowFocusKeys = ({ containerRef, rowSelector, onSearch }: Params): void => {
  useListKeys({
    keys: NO_KEYS,
    selectedKey: null,
    onSelect: () => undefined,
    onActivate: () => undefined,
    rows: { containerRef, rowSelector },
    ...(onSearch !== undefined && { onSearch }),
  });
};
