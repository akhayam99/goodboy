type Params = {
  readonly hasLoaded: boolean;
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly count: number;
};

export const loadStateOf = ({
  hasLoaded,
  isLoading,
  error,
  count,
}: Params): 'loading' | 'error' | 'empty' | 'ready' => {
  if (count > 0) {
    return 'ready';
  }
  if (error !== null && error !== undefined) {
    return 'error';
  }
  if (!hasLoaded) {
    return 'loading';
  }
  if (isLoading) {
    return 'empty';
  }
  return 'empty';
};
