const isNonEmptyId = <Id extends string>(value: string): value is Id => value !== '';

type BrandIdParams = {
  readonly value: string;
};

export const brandId = <Id extends string>({ value }: BrandIdParams): Id => {
  if (isNonEmptyId<Id>(value)) {
    return value;
  }
  throw new Error('An id cannot be empty');
};
