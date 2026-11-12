import type { ReactNode } from 'react';

type Props = {
  readonly start: ReactNode;
  readonly end: ReactNode;
};

export const ComposerFooter = ({ start, end }: Props) => (
  <div
    data-composer-footer=""
    className="flex min-h-8 min-w-0 items-center justify-between gap-2 px-3 pb-2"
  >
    <div className="flex min-w-0 items-center gap-2">{start}</div>
    <div className="flex min-w-0 items-center gap-2">{end}</div>
  </div>
);
