import type { ReactNode } from 'react';

export const Frame = ({ children }: { readonly children: ReactNode }) => (
  <div className="flex min-h-full w-full flex-col gap-6 bg-background p-6 text-foreground">
    {children}
  </div>
);
