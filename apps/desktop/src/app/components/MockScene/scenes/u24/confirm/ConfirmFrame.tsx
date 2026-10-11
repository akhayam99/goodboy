import type { ReactNode } from 'react';

type Props = {
  readonly name: string;
  readonly children: ReactNode;
};

export const ConfirmFrame = ({ name, children }: Props) => (
  <section
    aria-label={name}
    data-slot="confirm-frame"
    className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-soft bg-background p-2"
  >
    <h2 data-slot="confirm-frame-title" className="px-2 py-1 text-label text-muted-foreground">
      {name}
    </h2>
    <div className="flex min-w-0 flex-col gap-1">{children}</div>
  </section>
);
