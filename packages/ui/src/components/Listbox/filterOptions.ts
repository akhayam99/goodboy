import type { ListboxOption, ListboxValue } from './listboxTypes';

export type ListboxMatch = ReadonlyArray<number>;

export type FilteredOption<T extends ListboxValue> = {
  readonly option: ListboxOption<T>;
  readonly match: ListboxMatch;
};

type Params<T extends ListboxValue> = {
  readonly options: ReadonlyArray<ListboxOption<T>>;
  readonly query: string;
};

type MatchParams = {
  readonly label: string;
  readonly needle: string;
};

const NO_MATCH: ListboxMatch = [];

const subsequence = ({ label, needle }: MatchParams): ListboxMatch | null => {
  const indices: number[] = [];
  let cursor = 0;
  for (const char of needle) {
    const found = label.indexOf(char, cursor);
    if (found === -1) {
      return null;
    }
    indices.push(found);
    cursor = found + 1;
  }
  return indices;
};

export const matchLabel = ({ label, needle }: MatchParams): ListboxMatch | null => {
  const haystack = label.toLowerCase();
  const start = haystack.indexOf(needle);
  if (start !== -1) {
    return Array.from({ length: needle.length }, (_, offset) => start + offset);
  }
  return subsequence({ label: haystack, needle });
};

export const filterOptions = <T extends ListboxValue>({
  options,
  query,
}: Params<T>): ReadonlyArray<FilteredOption<T>> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return options.map((option) => ({ option, match: NO_MATCH }));
  }
  return options.flatMap((option) => {
    const match = matchLabel({ label: option.label, needle });
    if (match !== null) {
      return [{ option, match }];
    }
    const keywords = option.keywords ?? '';
    if (keywords !== '' && keywords.toLowerCase().includes(needle)) {
      return [{ option, match: NO_MATCH }];
    }
    return [];
  });
};
