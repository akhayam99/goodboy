import { ROLE_LIBRARY, type RoleLibraryEntry } from './roleLibrary';

type Params = {
  readonly query: string;
  readonly exclude?: ReadonlyArray<string>;
};

const normalize = ({ value }: { readonly value: string }): string => value.trim().toLowerCase();

const matches = ({
  entry,
  query,
}: {
  readonly entry: RoleLibraryEntry;
  readonly query: string;
}): boolean =>
  normalize({ value: entry.label }).includes(query) ||
  entry.aliases.some((alias) => {
    const normalized = normalize({ value: alias });
    return normalized === query || normalized.startsWith(query);
  });

export const matchRoleLibrary = ({
  query,
  exclude = [],
}: Params): ReadonlyArray<RoleLibraryEntry> => {
  const normalized = normalize({ value: query });
  const taken = new Set(exclude.map((label) => normalize({ value: label })));
  return ROLE_LIBRARY.filter(
    (entry) =>
      !taken.has(normalize({ value: entry.label })) &&
      (normalized === '' || matches({ entry, query: normalized })),
  );
};
