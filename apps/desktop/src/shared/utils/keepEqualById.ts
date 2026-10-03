import { isSameData } from './isSameData';

type KeepParams<T> = {
  readonly previous: ReadonlyMap<string, T>;
  readonly next: ReadonlyArray<T>;
};

export const keepEqualById = <T extends { readonly id: string }>({
  previous,
  next,
}: KeepParams<T>): ReadonlyArray<T> =>
  next.map((value) => {
    const known = previous.get(value.id);
    return known !== undefined && isSameData({ first: known, second: value }) ? known : value;
  });
