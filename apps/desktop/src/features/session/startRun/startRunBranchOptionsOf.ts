import type { ListboxOption } from '@goodboy/ui';

type Params = {
  readonly branches: ReadonlyArray<string>;
  readonly picked: string | null;
};

export type StartRunBranchChoice = Readonly<{
  options: ReadonlyArray<ListboxOption<string>>;
  value: string;
  label: string;
  anyValue: string;
}>;

const ANY_VALUE = '';

const ANY_LABEL = 'Any branch';

export const startRunBranchOptionsOf = ({
  branches,
  picked,
}: Params): StartRunBranchChoice | null => {
  const named = [...new Set([...branches, ...(picked === null ? [] : [picked])])];
  const [only] = named;
  if (only === undefined) {
    return null;
  }
  const options =
    named.length === 1
      ? [{ value: only, label: only }]
      : [
          { value: ANY_VALUE, label: ANY_LABEL },
          ...named.map((branch) => ({ value: branch, label: branch })),
        ];
  const value = picked ?? (named.length === 1 ? only : ANY_VALUE);
  return {
    options,
    value,
    label: value === ANY_VALUE ? ANY_LABEL : value,
    anyValue: ANY_VALUE,
  };
};
