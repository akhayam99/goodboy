type Params = {
  readonly authPlan: string | null | undefined;
  readonly limitsPlan: string | null | undefined;
};

type CapitalParams = {
  readonly value: string | null | undefined;
};

const capitalized = ({ value }: CapitalParams): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') {
    return null;
  }
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

export const planLabelOf = ({ authPlan, limitsPlan }: Params): string | null =>
  capitalized({ value: authPlan }) ?? capitalized({ value: limitsPlan });
