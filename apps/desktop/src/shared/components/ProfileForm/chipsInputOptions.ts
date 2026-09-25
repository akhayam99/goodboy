export type ChipSuggestion = Readonly<{
  label: string;
  group?: string;
}>;

export type ChipOption = Readonly<{
  key: string;
  label: string;
  value: string;
  group?: string;
  isCustom: boolean;
}>;

type Params = {
  readonly query: string;
  readonly values: ReadonlyArray<string>;
  readonly suggestions: ReadonlyArray<ChipSuggestion>;
  readonly customLabel: (params: { readonly query: string }) => string;
};

export const chipsInputOptions = ({
  query,
  values,
  suggestions,
  customLabel,
}: Params): ReadonlyArray<ChipOption> => {
  const trimmed = query.replace(/\s+/g, ' ').trim();
  if (trimmed === '') {
    return [];
  }
  const lower = trimmed.toLowerCase();
  const taken = new Set(values.map((value) => value.toLowerCase()));
  const suggested: ReadonlyArray<ChipOption> = suggestions
    .filter((suggestion) => !taken.has(suggestion.label.toLowerCase()))
    .map((suggestion) => ({
      key: `suggestion:${suggestion.label}`,
      label: suggestion.label,
      value: suggestion.label,
      ...(suggestion.group !== undefined && { group: suggestion.group }),
      isCustom: false,
    }));
  const isKnown =
    taken.has(lower) || suggested.some((option) => option.value.toLowerCase() === lower);
  if (isKnown) {
    return suggested;
  }
  return [
    ...suggested,
    {
      key: `custom:${trimmed}`,
      label: customLabel({ query: trimmed }),
      value: trimmed,
      isCustom: true,
    },
  ];
};
