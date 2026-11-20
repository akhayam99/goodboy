import type { ReactNode } from 'react';

type Params = {
  readonly id: string;
  readonly error: ReactNode;
};

export const fieldErrorAriaOf = ({ id, error }: Params) => {
  const hasError = error != null && error !== false && error !== '';
  return {
    'aria-invalid': hasError ? true : undefined,
    'aria-describedby': hasError ? id : undefined,
  } as const;
};
