import type { ReactNode } from 'react';

export type BranchWorkHeading = Readonly<{
  label: string;
  mark: ReactNode;
  action: ReactNode;
}>;
