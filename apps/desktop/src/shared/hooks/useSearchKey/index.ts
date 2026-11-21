import { useListKeys } from '../useListKeys';

type Params = {
  readonly onSearch: () => void;
};

const NO_KEYS: ReadonlyArray<string> = [];

export const useSearchKey = ({ onSearch }: Params): void => {
  useListKeys({
    keys: NO_KEYS,
    selectedKey: null,
    onSelect: () => undefined,
    onActivate: () => undefined,
    onSearch,
  });
};
