import { useRef } from 'react';

type Params<T> = {
  readonly value: T;
  readonly isFrozen: boolean;
};

export const useFrozenOrder = <T>({ value, isFrozen }: Params<T>): T => {
  const frozenRef = useRef<T>(value);
  if (!isFrozen) {
    frozenRef.current = value;
  }
  return frozenRef.current;
};
