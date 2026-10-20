type Params<T> = {
  readonly ref: React.Ref<T> | undefined;
  readonly value: T | null;
};

export const assignRef = <T>({ ref, value }: Params<T>): void => {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref != null) {
    Object.assign(ref, { current: value });
  }
};
