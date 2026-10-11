type ArrivalTitleParams = {
  readonly version: string | null;
};

export const arrivalTitle = ({ version }: ArrivalTitleParams): string =>
  `${version ?? 'Update'} is ready`;
